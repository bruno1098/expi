import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaUser } from "react-icons/fa";
import Peer from 'simple-peer';
import { ref, set, get, push, runTransaction, onValue, getDatabase } from "firebase/database";
import { database, getNextUraId } from "../pages/api/feedback";
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const Canais = ({ usersInCall, setUsersInCall, userName, setUserName, userId, setIsUserModalOpen, addVoiceMessage }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null); // Ref para o fluxo de áudio local
  const peer = useRef(null);
  const socket = useRef(null);
  const recognition = useRef(null);
  const callSessionIdRef = useRef(null);
  const [transcription, setTranscription] = useState("");
  const feedbackSent = useRef(false); // Evita envio duplicado de feedback
  const isLeaving = useRef(false); // Evita múltiplas chamadas de saída

  // Estado para gerenciar mensagens da conversa
  const [messages, setMessages] = useState([]);


  useEffect(() => {
    if (!socket.current) {
      socket.current = new WebSocket('wss://serverexpi.onrender.com');

      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
      };

      socket.current.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        console.log("Mensagem recebida no WebSocket:", data);

        if (data.userId !== userId) {
          if (data.signalData) {
            console.log('Recebido sinal do peer:', data.signalData);
            handleIncomingCall(data);
          }

          // Verificar se a mensagem é uma transcrição
          if (data.type === 'transcription' && data.text) {
            addMessage({ sender: 'peer', content: data.text });
            addVoiceMessage({ senderId: data.userId,
              senderName: data.userName || 'Usuário', // Define um valor padrão se userName estiver undefined
              content: data.text,});
          }
        }
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket no cliente:', error);
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
        socket.current = null;
      };
    }

    return () => {
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
    };
  }, [userId]); // Adiciona userId como dependência

  // Gerenciar desconexões abruptas
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInCall && !isLeaving.current) {
        leaveVoiceChannel();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isInCall]);

  const createPeer = (isInitiator, incomingSignal = null) => {
    console.log("Criando Peer. Iniciador:", isInitiator);
    peer.current = new Peer({
      initiator: isInitiator,
      trickle: false,
      stream: localStreamRef.current,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
        ],
      },
    });

    peer.current.on('signal', (signal) => {
      console.log('Emitting signal:', signal);
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        const payload = {
          type: 'transcription',
          text: transcript,
          userId,
          userName, // Incluindo o nome do usuário
        };
        socket.current.send(JSON.stringify(payload));
      }
      
    });

    peer.current.on('connect', () => {
      console.log('Conexão P2P estabelecida');
    });

    peer.current.on('stream', (stream) => {
      console.log('Stream recebida do peer');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
        remoteAudioRef.current.play().catch((error) => {
          console.error('Erro ao reproduzir o áudio remoto:', error);
        });
      }
    });

    peer.current.on('error', (err) => {
      console.error('Erro no peer:', err);
    });

    if (incomingSignal) {
      peer.current.signal(incomingSignal);
    }
  }

  const enterVoiceChannel = async (channelName) => {
    if (!userName) {
      setIsUserModalOpen(true);
      return;
    }

    setCurrentChannel(channelName);

    // Referência para o canal no Firebase
    const channelRef = ref(database, `channels/${channelName}`);

    let callSessionId;

    await runTransaction(channelRef, (currentData) => {
      if (currentData === null) {
        // Nenhum callSessionId existe, criar um novo
        callSessionId = uuidv4();
        return { callSessionId, userCount: 1 };
      } else {
        // callSessionId existe, incrementar userCount
        callSessionId = currentData.callSessionId;
        return { ...currentData, userCount: (currentData.userCount || 0) + 1 };
      }
    });

    callSessionIdRef.current = callSessionId;

    // Adicionar o usuário à lista de usuários no Firebase
    const usersRef = ref(database, `channels/${channelName}/users/${userId}`);
    await set(usersRef, userName);

    // Ouvir mudanças na lista de usuários
    const usersListRef = ref(database, `channels/${channelName}/users`);
    onValue(usersListRef, (snapshot) => {
      const users = snapshot.val() ? Object.values(snapshot.val()) : [];
      setUsersInCall(users);
    });

    // Obter o stream de áudio local
    let localStream;
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }
      localStreamRef.current = localStream; // Armazenar o fluxo de áudio local
    } catch (error) {
      console.error('Erro ao acessar o microfone:', error);
      alert('Não foi possível acessar o microfone. Verifique se você tem um microfone conectado e se o navegador tem permissão para acessá-lo.');
      return;
    }

    // Iniciar reconhecimento de fala
    startSpeechRecognition();

    // Obter o número de usuários no canal
    const channelSnapshot = await get(channelRef);
    const userCount = channelSnapshot.exists() ? channelSnapshot.val().userCount : 1;

    // Definir se você é o iniciador
    if (userCount === 1) {
      createPeer(true);
    } else {
      createPeer(false);
    }

    // Notifica os outros usuários que você entrou no canal
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ userId, joined: true }));
    }

    setIsInCall(true);
  };

  const leaveVoiceChannel = async () => {
    if (!callSessionIdRef.current) {
      console.log("Nenhuma sessão ativa para sair.");
      return;
    }

    if (isLeaving.current) {
      console.log("Já está processando a saída do canal.");
      return;
    }

    isLeaving.current = true; // Marcar como em processo de saída

    try {
      if (peer.current) {
        peer.current.destroy();
        peer.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }

      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify({ userId, left: true }));
      }

      // Parar reconhecimento de fala
      stopSpeechRecognition();

      setIsInCall(false);

      // Remover o usuário da lista de usuários no Firebase
      const usersRef = ref(database, `channels/${currentChannel}/users/${userId}`);
      await set(usersRef, null);

      // Decrementar userCount no Firebase
      const channelRef = ref(database, `channels/${currentChannel}`);
      await runTransaction(channelRef, (currentData) => {
        if (currentData !== null) {
          const newUserCount = (currentData.userCount || 1) - 1;
          if (newUserCount <= 0) {
            return null; // Remover canal se não houver usuários
          } else {
            return { ...currentData, userCount: newUserCount };
          }
        }
        return currentData;
      });

      const currentCallSessionId = callSessionIdRef.current; // Armazena o ID atual antes de limpar
      callSessionIdRef.current = null; // Limpar o ID da sessão

      console.log("Saindo do canal de voz");

      // Verificar se o feedback já foi enviado
      if (!feedbackSent.current && transcription.trim() !== "") {
        try {
          const feedback = await analyzeConversationWithGPT(transcription);
          console.log("Feedback gerado:", feedback);

          // Salvar o feedback no Firebase em /ura/{callSessionId}/feedback
          const uraRef = ref(database, `ura/${currentCallSessionId}/feedback`);
          await set(uraRef, feedback);
          console.log("Feedback salvo no Firebase.");

          // Marcar como enviado
          feedbackSent.current = true;

        } catch (error) {
          console.error("Erro ao enviar transcrição para análise:", error);
        }
      } else {
        console.log("Feedback já foi enviado ou não há transcrição.");
      }

      // Limpar a transcrição acumulada
      setTranscription("");
    } finally {
      isLeaving.current = false; // Resetar o estado de saída
    }
  };

  const processedSignals = useRef(new Set());

  const handleIncomingCall = useCallback(async (data) => {
    const signalId = JSON.stringify(data.signalData);
    if (processedSignals.current.has(signalId)) {
      console.log('Sinal já processado, ignorando.');
      return;
    }
    processedSignals.current.add(signalId);

    if (!peer.current) {
      // Obter o stream de áudio local
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (localAudioRef.current) {
          localAudioRef.current.srcObject = localStream;
        }
        localStreamRef.current = localStream; // Armazenar o fluxo de áudio local
      } catch (error) {
        console.error('Erro ao acessar o microfone:', error);
        return;
      }
      createPeer(false, data.signalData);
    } else {
      peer.current.signal(data.signalData);
    }

    // Dentro de handleIncomingCall
    console.log('Received signal data:', data.signalData);

  }, [createPeer]);

  // Funções para reconhecimento de fala
  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("API de reconhecimento de fala não suportada neste navegador.");
      return;
    }

    recognition.current = new SpeechRecognition();
    recognition.current.continuous = true;
    recognition.current.interimResults = false;
    recognition.current.lang = 'pt-BR';

    recognition.current.onresult = async (event) => {
      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript.trim();

      console.log("Transcrição:", transcript);

      if (transcript) {
        setTranscription((prev) => prev + " " + transcript);
        addMessage({ sender: 'self', content: transcript });
        addVoiceMessage({
          senderId: userId,
          senderName: userName, // Certifique-se de que userName não está undefined
          content: transcript,
        });
        

        // Enviar a transcrição para o outro usuário via WebSocket
        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
          const payload = {
            type: 'transcription',
            text: transcript,
            userId,
            userName, // Adicionado
          };
          socket.current.send(JSON.stringify(payload));
        }

      }
    };

    recognition.current.onerror = (event) => {
      console.error("Erro no reconhecimento de fala:", event.error);
    };

    recognition.current.start();
    console.log("Reconhecimento de fala iniciado.");
  };

  const stopSpeechRecognition = () => {
    if (recognition.current) {
      recognition.current.stop();
      console.log("Reconhecimento de fala parado.");
    }
  };

  // Função para adicionar mensagens à lista
  const addMessage = (message) => {
    setMessages((prevMessages) => [...prevMessages, message]);
  };

  const analyzeConversationWithGPT = async (conversation) => {
    const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY; // Sua chave da API

    try {
      // Verificar se a conversa é válida
      if (!conversation || conversation.trim() === "") {
        throw new Error("Conversa vazia ou inválida.");
      }

      // Primeiro, obter a análise da conversa
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "Você é um assistente que analisa conversas de atendimento ao cliente." },
            {
              role: "user", content: `
              Analise a seguinte conversa de atendimento ao cliente. Identifique quem é o cliente e quem é o atendente com base em palavras-chave.
              Analise o sentimento da conversa e determine se o cliente foi atendido de forma correta, se ficou satisfeito ou insatisfeito, e forneça feedback sobre como melhorar o atendimento.
  
              Conversa:
              ${conversation}
  
              Análise:
            ` },
          ],
          max_tokens: 300,
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );

      const analysis = response.data.choices[0].message.content.trim();

      // Verificar se a análise é válida
      if (!analysis) {
        throw new Error("Falha ao gerar análise da conversa.");
      }

      // Agora, gerar a categorização (rating) com base na análise
      const categorizationPrompt = `
        Dado o seguinte feedback:
  
        "${analysis}"
  
        Categorize este feedback como uma única palavra entre: "Bom", "Ruim", "Neutro", "Insatisfeito". 
        Apenas responda com uma dessas palavras e nada mais.
      `;

      const categorizationResponse = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "Você é um assistente que categoriza feedbacks." },
            { role: "user", content: categorizationPrompt },
          ],
          max_tokens: 10,
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );

      const categoryResult = categorizationResponse.data.choices[0].message.content.trim();

      // Verificar se a categorização foi gerada
      if (!categoryResult) {
        throw new Error("Falha ao categorizar a conversa.");
      }

      // Preparar os dados do feedback
      const feedbackData = {
        id: await getNextUraId(), // Função para obter o próximo ID único
        usuario: userName, // Substitua pelo nome real do usuário
        comentario: analysis,
        rating: categoryResult,
        data: new Date().toISOString(),
      };

      // Verificar se o feedback já existe no Firebase antes de salvar
      const feedbackRef = ref(database, `ura/${feedbackData.id}`);
      const feedbackSnapshot = await get(feedbackRef);

      if (!feedbackSnapshot.exists()) {
        // Salvar o feedback no Firebase se ele não existir
        await set(feedbackRef, feedbackData);
        console.log("Feedback salvo com sucesso no Firebase.");
      } else {
        console.log("Feedback já existe no Firebase.");
      }

      // Retornar a análise e o rating, se necessário
      return { analysis, rating: categoryResult };

    } catch (error) {
      console.error("Erro ao analisar a conversa com o GPT:", error);
      throw new Error("Erro ao analisar a conversa.");
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-background text-foreground">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>

      <div className="w-full max-w-md bg-background rounded-md p-4">
        <h3 className="text-lg font-semibold mb-2">Canais</h3>
        <ul className="space-y-2">
          <li
            className={`flex flex-col items-start p-2 rounded cursor-pointer bg-muted ${currentChannel === 'Tudo que eu quero' ? 'bg-primary' : ''}`}
            onClick={() => (isInCall ? leaveVoiceChannel() : enterVoiceChannel('Tudo que eu quero'))}
          >
            <span className="text-foreground">Tudo que eu quero</span>

            {currentChannel === 'Tudo que eu quero' && usersInCall.length > 0 && (
              <ul className="pl-4 pt-2 space-y-1">
                {usersInCall.map((user, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <FaUser className="text-muted-foreground" />
                    <span>{user}</span>
                  </li>
                ))}
                <Button onClick={leaveVoiceChannel} className="mt-4">Sair</Button>
              </ul>
            )}
          </li>
        </ul>
      </div>

      {/* Exibição das mensagens da conversa */}


      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default Canais;
