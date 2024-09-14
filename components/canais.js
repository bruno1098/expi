import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaUser } from "react-icons/fa";
import Peer from 'simple-peer';
import { ref, set, get, push } from "firebase/database";
import { database } from "../pages/api/feedback"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; 
import { v4 as uuidv4 } from 'uuid';

const Canais = ({ usersInCall, setUsersInCall, userName, setUserName, userId, setIsUserModalOpen }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const sessionIdRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const socket = useRef(null);
  const recognition = useRef(null);
  const callSessionIdRef = useRef(null);

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

          if (data.joined) {
            const remoteUserName = await getUserNameFromFirebase(data.userId);
            setUsersInCall((prevUsers) => {
              if (!prevUsers.includes(remoteUserName)) {
                return [...prevUsers, remoteUserName];
              }
              return prevUsers;
            });
          }

          if (data.left) {
            const remoteUserName = await getUserNameFromFirebase(data.userId);
            setUsersInCall((prevUsers) => prevUsers.filter((user) => user !== remoteUserName));
          }
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

  // Limpar o callSessionId ao fechar a aba ou atualizar a página
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const channelRef = ref(database, `channels/${currentChannel}`);
      await set(channelRef, null);
      console.log("Sessão encerrada devido a atualização ou fechamento da aba.");
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentChannel]);

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

    // Criar sempre um novo callSessionId ao entrar no canal
    const callSessionId = uuidv4();
    const channelRef = ref(database, `channels/${channelName}`);
    await set(channelRef, { callSessionId });
    callSessionIdRef.current = callSessionId;

    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    startSpeechRecognition();

    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ userId, joined: true }));
    }

    if (usersInCall.length === 0) {
      createPeer(true);
    }

    setUsersInCall((prevUsers) => [...prevUsers, userName]);
  };

  const leaveVoiceChannel = async () => {
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
    }

    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ userId, left: true }));
    }

    stopSpeechRecognition();
    setUsersInCall((prevUsers) => prevUsers.filter((user) => user !== userName));
    setIsInCall(false);
    setCurrentChannel(null);

    const channelRef = ref(database, `channels/${currentChannel}`);
    await set(channelRef, null);

    callSessionIdRef.current = null;
    window.location.reload();
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

    const remoteUserName = await getUserNameFromFirebase(data.userId);
    setUsersInCall((prevUsers) => {
      if (!prevUsers.includes(remoteUserName)) {
        return [...prevUsers, remoteUserName];
      }
      return prevUsers;
    });
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
    const transcript = result[0].transcript;

    console.log("Transcrição:", transcript);

    if (callSessionIdRef.current) {
      // Enviar transcrição para o Firebase em /ura/{callSessionId}/transcriptions
      const uraSessionRef = ref(database, `ura/${callSessionIdRef.current}/transcriptions`);
      await push(uraSessionRef, {
        text: transcript,
        userId: userId,
        timestamp: Date.now(),
      });
    } else {
      console.error("callSessionId não está definido.");
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
                    <span>{user === 'self' ? userName : user}</span>
                    <Button onClick={leaveVoiceChannel} className="mt-4">Sair</Button>
                  </li>
                ))}
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
