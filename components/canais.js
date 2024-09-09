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

  const createPeer = useCallback((initiator) => {
    const peerInstance = new Peer({
      initiator,
      trickle: false,
      stream: localAudioRef.current.srcObject // Passa o áudio local para o peer
    });

    // Recebe o sinal e envia através do WebSocket
    peerInstance.on('signal', (data) => {
      console.log('Sinal enviado:', data); // Verifique os dados de sinal
      socket.current.send(JSON.stringify(data));
    });

    // Quando o stream remoto for recebido
    peerInstance.on('stream', (stream) => {
      console.log('Stream remoto recebido');
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setIsInConversation(true); // Outro usuário entrou na chamada
    });

    peerInstance.on('close', () => {
      console.log('Conexão Peer encerrada');
      endCall();
    });

    peerInstance.on('error', (err) => {
      console.error('Erro no Peer:', err);
    });

    peer.current = peerInstance;
  }, []);

  const startCall = async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }
      
      socket.current = new WebSocket('wss://3a8a-2804-4dd0-c002-9600-3446-cbdc-6721-6a1c.ngrok-free.app');

      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
      };

      socket.current.onmessage = (message) => {
        console.log('Mensagem recebida via WebSocket:', message.data);
        const data = JSON.parse(message.data);
        if (peer.current) {
          peer.current.signal(data); // Passa o sinal para o peer
        }
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
        setTimeout(() => {
          startCall(); // Tenta reconectar após a desconexão
        }, 3000);
      };

      createPeer(true); // Inicia o peer como iniciador
      setIsInCall(true);
    } catch (error) {
      console.error('Erro ao acessar o microfone:', error);
    }
  };

  const endCall = () => {
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
    }
    if (socket.current) {
      socket.current.close();
      socket.current = null;
    }
    setIsInCall(false);
    setIsInConversation(false);
  };

  const handleIncomingCall = async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }

      socket.current = new WebSocket('wss://3a8a-2804-4dd0-c002-9600-3446-cbdc-6721-6a1c.ngrok-free.app');

      socket.current.onmessage = (message) => {
        console.log('Mensagem recebida via WebSocket:', message.data);
        const data = JSON.parse(message.data);
        if (peer.current) {
          peer.current.signal(data); // Passa o sinal para o peer
        }
      };

      createPeer(false); // Cria o peer sem ser o iniciador
      setIsInCall(true);
    } catch (error) {
      console.error('Erro ao acessar o microfone:', error);
    }
  };

  useEffect(() => {
    const createWebSocket = () => {
      socket.current = new WebSocket('wss://3a8a-2804-4dd0-c002-9600-3446-cbdc-6721-6a1c.ngrok-free.app');

      socket.current.onopen = () => {
        console.log('Esperando por chamadas...');
      };

      socket.current.onmessage = (message) => {
        console.log('Chamada recebida');
        handleIncomingCall(); // Chamada recebida
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado, tentando reconectar...');
        setTimeout(createWebSocket, 3000); // Tentar reconectar após 3 segundos
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
