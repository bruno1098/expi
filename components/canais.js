import React, { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FaPhoneAlt } from "react-icons/fa";
import Peer from 'simple-peer';

const Canais = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [isInConversation, setIsInConversation] = useState(false);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const socket = useRef(null);
  const isSocketOpen = useRef(false); // Estado para verificar se o WebSocket está aberto

  const createPeer = useCallback((initiator) => {
    const peerInstance = new Peer({
      initiator,
      trickle: false,
      stream: localAudioRef.current.srcObject
    });

    peerInstance.on('signal', (data) => {
      if (isSocketOpen.current) {
        socket.current.send(JSON.stringify(data));
      } else {
        console.log("WebSocket ainda não está aberto para enviar mensagens.");
      }
    });

    peerInstance.on('stream', (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setIsInConversation(true);
    });

    peerInstance.on('close', () => {
      endCall();
    });

    peer.current = peerInstance;
  }, []);

  const startCall = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    socket.current = new WebSocket('wss://3b85-2804-4dd0-c002-9600-3446-cbdc-6721-6a1c.ngrok-free.app ');

    socket.current.onopen = () => {
      console.log('Conexão WebSocket estabelecida');
      isSocketOpen.current = true;
    };

    socket.current.onerror = (err) => {
      console.error('Erro no WebSocket:', err);
    };

    socket.current.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (peer.current) {
        peer.current.signal(data);
      }
    };

    socket.current.onclose = () => {
      console.log('WebSocket desconectado, tentando reconectar...');
      isSocketOpen.current = false;
      endCall();
    };

    createPeer(true);
    setIsInCall(true);
  };

  const endCall = () => {
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
    }
    setIsInCall(false);
    setIsInConversation(false);
  };

  const handleIncomingCall = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    socket.current = new WebSocket('wss://3b85-2804-4dd0-c002-9600-3446-cbdc-6721-6a1c.ngrok-free.app ');

    socket.current.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (peer.current) {
        peer.current.signal(data);
      }
    };

    createPeer(false);
    setIsInCall(true);
  };

  useEffect(() => {
    const createWebSocket = () => {
      socket.current = new WebSocket('wss://3b85-2804-4dd0-c002-9600-3446-cbdc-6721-6a1c.ngrok-free.app ');

      socket.current.onopen = () => {
        console.log('Esperando por chamadas...');
        isSocketOpen.current = true;
      };

      socket.current.onmessage = (message) => {
        handleIncomingCall();
      };

      socket.current.onerror = (err) => {
        console.error('Erro no WebSocket:', err);
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado, tentando reconectar...');
        isSocketOpen.current = false;
      };
    };

    createWebSocket();

    return () => {
      if (socket.current) {
        socket.current.close();
      }
    };
  }, [handleIncomingCall]);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-auto">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>

      {isInCall && (
        <div className="p-4 bg-green-500 text-white rounded-md mb-4 flex items-center gap-4">
          <FaPhoneAlt />
          <span>Você está em uma chamada!</span>
        </div>
      )}

      <div className="grid gap-4">
        <div className="flex items-center gap-4 p-3 bg-muted rounded-md hover:bg-muted-hover cursor-pointer" onClick={startCall}>
          <Avatar className="w-10 h-10">
            <AvatarImage src="/icons/channel1.png" alt="Channel 1" />
            <AvatarFallback>C1</AvatarFallback>
          </Avatar>
          <span className="text-lg">Canal de Voz 1</span>
        </div>
      </div>

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      {isInConversation && (
        <div className="flex items-center mt-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src="/icons/user_active.png" alt="Outro usuário" />
            <AvatarFallback>Outra pessoa</AvatarFallback>
          </Avatar>
          <span className="ml-2 text-lg">Outra pessoa entrou na chamada</span>
        </div>
      )}

      {isInCall && (
        <button onClick={endCall} className="mt-4 p-2 bg-red-600 text-white rounded-md">
          Encerrar Chamada
        </button>
      )}
    </div>
  );
};

export default Canais;
