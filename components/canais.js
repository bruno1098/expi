import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaUser } from "react-icons/fa";
import Peer from 'simple-peer';
import { ref, set, get, runTransaction, onValue } from "firebase/database";
import { database } from "../pages/api/feedback"; 
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

const Canais = ({ usersInCall, setUsersInCall, userName, setUserName, userId, setIsUserModalOpen }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const localAudioRef = useRef(null);
  const peerConnections = useRef({}); // Gerencia múltiplos peers
  const socket = useRef(null);
  const recognition = useRef(null);
  const callSessionIdRef = useRef(null);
  const [transcription, setTranscription] = useState(""); 

  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({}); // Gerencia múltiplos streams remotos

  // Função para obter o stream de áudio local
  const getLocalStream = async () => {
    if (!localStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(stream);
        return stream;
      } catch (error) {
        console.error('Erro ao obter o stream de áudio local:', error);
      }
    } else {
      return localStream;
    }
  };

  // Atualiza o srcObject do localAudioRef quando localStream muda
  useEffect(() => {
    if (localAudioRef.current && localStream) {
      localAudioRef.current.srcObject = localStream;
    }
  }, [localAudioRef, localStream]);

  // Inicializa o WebSocket apenas uma vez
  useEffect(() => {
    if (!socket.current) {
      socket.current = new WebSocket('wss://serverexpi.onrender.com/ws');

      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
      };

      socket.current.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        console.log("Mensagem recebida no WebSocket:", data);

        if (data.callSessionId !== callSessionIdRef.current || data.userId === userId) {
          // Ignora mensagens não relevantes
          return;
        }

        switch (data.type) {
          case 'join':
            console.log('Usuário entrou:', data.userId);
            if (!peerConnections.current[data.userId]) {
              const peerInstance = createPeerConnection(data.userId, false);
              peerConnections.current[data.userId] = peerInstance;
            }
            break;

          case 'signal':
            const { userId: remoteUserId, signalData } = data;
            const peer = peerConnections.current[remoteUserId];
            if (peer) {
              peer.signal(signalData);
            } else {
              console.log('Peer não encontrado para o usuário:', remoteUserId);
            }
            break;

          case 'leave':
            console.log('Usuário saiu:', data.userId);
            const peerToRemove = peerConnections.current[data.userId];
            if (peerToRemove) {
              peerToRemove.destroy();
              delete peerConnections.current[data.userId];
              setRemoteStreams(prevStreams => {
                const updatedStreams = { ...prevStreams };
                delete updatedStreams[data.userId];
                return updatedStreams;
              });
            }
            break;

          default:
            break;
        }
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
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
  }, [userId]);

  // Gerencia desconexões abruptas
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isInCall) {
        leaveVoiceChannel();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isInCall]);

  const createPeerConnection = (targetUserId, initiator) => {
    const peerInstance = new Peer({
      initiator,
      trickle: false,
      stream: localStream,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
    });

    peerInstance.on('signal', (signalData) => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify({
          type: 'signal',
          userId, // Nosso userId
          targetUserId, // Destinatário
          signalData,
          callSessionId: callSessionIdRef.current,
        }));
      }
    });

    peerInstance.on('stream', (stream) => {
      setRemoteStreams(prevStreams => ({ ...prevStreams, [targetUserId]: stream }));
    });

    peerInstance.on('close', () => {
      console.log('Peer connection closed with', targetUserId);
      delete peerConnections.current[targetUserId];
      setRemoteStreams(prevStreams => {
        const updatedStreams = { ...prevStreams };
        delete updatedStreams[targetUserId];
        return updatedStreams;
      });
    });

    peerInstance.on('error', (err) => {
      console.error('Peer error:', err);
    });

    return peerInstance;
  };

  const enterVoiceChannel = async (channelName) => {
    if (!userName) {
      setIsUserModalOpen(true);
      return;
    }

    setCurrentChannel(channelName);

    const channelRef = ref(database, `channels/${channelName}`);

    let callSessionId;

    await runTransaction(channelRef, (currentData) => {
      if (currentData === null) {
        callSessionId = uuidv4();
        return { callSessionId, userCount: 1 };
      } else {
        callSessionId = currentData.callSessionId;
        return { ...currentData, userCount: (currentData.userCount || 0) + 1 };
      }
    });

    callSessionIdRef.current = callSessionId;

    const usersRef = ref(database, `channels/${channelName}/users/${userId}`);
    await set(usersRef, userName);

    const usersListRef = ref(database, `channels/${channelName}/users`);
    onValue(usersListRef, (snapshot) => {
      const users = snapshot.val() ? Object.values(snapshot.val()) : [];
      setUsersInCall(users);
    });

    await getLocalStream();

    startSpeechRecognition();

    const usersSnapshot = await get(usersListRef);
    const usersInChannel = usersSnapshot.val() ? usersSnapshot.val() : {};

    for (const otherUserId in usersInChannel) {
      if (otherUserId !== userId && !peerConnections.current[otherUserId]) {
        const peerInstance = createPeerConnection(otherUserId, true);
        peerConnections.current[otherUserId] = peerInstance;
      }
    }

    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({
        type: 'join',
        userId,
        callSessionId: callSessionIdRef.current,
      }));
    }

    setIsInCall(true);
  };

  const leaveVoiceChannel = async () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
      });
      setLocalStream(null);
    }

    for (const peer of Object.values(peerConnections.current)) {
      peer.destroy();
    }
    peerConnections.current = {};
    setRemoteStreams({});

    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({
        type: 'leave',
        userId,
        callSessionId: callSessionIdRef.current,
      }));
    }

    stopSpeechRecognition();

    setIsInCall(false);

    const usersRef = ref(database, `channels/${currentChannel}/users/${userId}`);
    await set(usersRef, null);

    const channelRef = ref(database, `channels/${currentChannel}`);

    await runTransaction(channelRef, (currentData) => {
      if (currentData !== null) {
        const newUserCount = (currentData.userCount || 1) - 1;
        if (newUserCount <= 0) {
          return null;
        } else {
          return { ...currentData, userCount: newUserCount };
        }
      } else {
        return null;
      }
    });

    const currentCallSessionId = callSessionIdRef.current;
    callSessionIdRef.current = null;
    setCurrentChannel(null);

    console.log("Saindo do canal de voz");

    if (transcription.trim() !== "") {
      try {
        const feedback = await analyzeConversationWithGPT(transcription);
        console.log("Feedback gerado:", feedback);

        const uraRef = ref(database, `ura/${currentCallSessionId}/feedback`);
        await set(uraRef, feedback);
        console.log("Feedback salvo no Firebase.");
      } catch (error) {
        console.error("Erro ao enviar transcrição para análise:", error);
      }
    }

    setTranscription("");
  };

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
      }
    };

    recognition.current.onerror = (event) => {
      console.error("Erro no reconhecimento de fala:", event.error);
    };

    recognition.current.onend = () => {
      // Reinicia o reconhecimento se necessário
      recognition.current.start();
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

  // Função para analisar a conversa com o GPT
  const analyzeConversationWithGPT = async (conversation) => {
    const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      console.error("OpenAI API Key não está definida.");
      throw new Error("OpenAI API Key não está definida.");
    }

    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "Você é um assistente que analisa conversas de atendimento ao cliente." },
            { role: "user", content: `
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
      return analysis;

    } catch (error) {
      console.error("Erro ao analisar a conversa com o GPT:", error);
      throw new Error("Erro ao analisar a conversa.");
    }
  };

  // Componente para renderizar streams remotos
  const RemoteAudio = ({ stream }) => {
    const audioRef = useRef();

    useEffect(() => {
      if (audioRef.current && stream) {
        audioRef.current.srcObject = stream;
      }
    }, [stream]);

    return <audio ref={audioRef} autoPlay playsInline />;
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

      {/* Elemento de áudio para o stream local */}
      <audio ref={localAudioRef} autoPlay playsInline muted />

      {/* Renderiza os streams remotos */}
      {Object.values(remoteStreams).map((stream, index) => (
        <RemoteAudio key={index} stream={stream} />
      ))}

    </div>
  );
};

export default Canais;
