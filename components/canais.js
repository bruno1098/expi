// File: components/Canais.js

import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaUser } from "react-icons/fa";
import Peer from 'simple-peer';
import { ref, set, get, push, runTransaction, onValue } from "firebase/database";
import { database } from "../pages/api/feedback"; 
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios'; // Import necessário para chamadas HTTP

const Canais = ({ usersInCall, setUsersInCall, userName, setUserName, userId, setIsUserModalOpen }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const socket = useRef(null);
  const recognition = useRef(null);
  const callSessionIdRef = useRef(null);
  const [transcription, setTranscription] = useState(""); // Estado para acumular transcrições

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

        if (data.userId !== userId) {
          if (data.signalData) {
            handleIncomingCall(data);
          }

          // As mudanças na lista de usuários já estão sendo ouvidas via Firebase
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

  // Gerenciar desconexões abruptas
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

  const createPeer = useCallback((initiator, signalData = null) => {
    const peerInstance = new Peer({
      initiator,
      trickle: false,
      stream: localAudioRef.current.srcObject,
    });

    peerInstance.on('signal', (signal) => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        const payload = { signalData: signal, userId };
        socket.current.send(JSON.stringify(payload));
      }
    });

    peerInstance.on('stream', (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setIsInCall(true);
    });

    peerInstance.on('error', (err) => {
      console.error("Erro no peer:", err);
    });

    peerInstance.on('close', () => {
      setIsInCall(false);
    });

    if (signalData) {
      peerInstance.signal(signalData);
    }

    peer.current = peerInstance;
  }, [userId]);

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
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
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
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
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
          // Nenhum usuário restante, remover o callSessionId
          return null;
        } else {
          // Atualizar userCount
          return { ...currentData, userCount: newUserCount };
        }
      } else {
        return null;
      }
    });

    const currentCallSessionId = callSessionIdRef.current; // Armazena o ID atual antes de limpar
    callSessionIdRef.current = null;
    setCurrentChannel(null);

    console.log("Saindo do canal de voz");

    // Enviar a transcrição acumulada para a API de análise
    if (transcription.trim() !== "") {
      try {
        const response = await axios.post("/api/analyze-audio", { 
          transcription, 
          callSessionId: currentCallSessionId 
        });
        console.log("Feedback gerado:", response.data.feedback);

        // Salvar o feedback no Firebase em /ura/{callSessionId}/feedback
        const uraRef = ref(database, `ura/${currentCallSessionId}/feedback`);
        await set(uraRef, response.data.feedback);
        console.log("Feedback salvo no Firebase.");
      } catch (error) {
        console.error("Erro ao enviar transcrição para análise:", error);
      }
    }

    // Limpar a transcrição acumulada
    setTranscription("");

    // Atualizar a página (opcional, se desejar recarregar)
    // window.location.reload();
  };

  const handleIncomingCall = useCallback(async (data) => {
    if (!peer.current) {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }
      createPeer(false, data.signalData);
    } else {
      peer.current.signal(data.signalData);
    }
  }, [createPeer]);

  const getUserNameFromFirebase = async (userId) => {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        return snapshot.val().name;
      } else {
        return "Outro Usuário";
      }
    } catch (error) {
      console.error("Erro ao buscar o nome do usuário:", error);
      return "Outro Usuário";
    }
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
      // Obter o resultado atual
      const result = event.results[event.resultIndex];
      // Obter a melhor alternativa (primeira)
      const transcript = result[0].transcript.trim();

      console.log("Transcrição:", transcript);

      if (transcript) {
        // Acumular a transcrição localmente
        setTranscription((prev) => prev + " " + transcript);
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

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default Canais;
