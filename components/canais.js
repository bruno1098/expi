import React, { useState, useRef, useEffect, useCallback } from "react";
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
      stream: localAudioRef.current.srcObject,
    });

    peerInstance.on('signal', (data) => {
      if (socket.current) {
        socket.current.send(JSON.stringify(data));
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

    socket.current = new WebSocket('wss://3b85-2804-4dd0-c002-9600-3446-cbdc-6721-6a1c.ngrok-free.app');

    socket.current.onopen = () => {
      console.log('Conexão WebSocket estabelecida');
    };

    socket.current.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (peer.current) {
        peer.current.signal(data);``
      }
    };

    socket.current.onclose = () => {
      console.log('WebSocket desconectado');
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
    if (socket.current) {
      socket.current.close();
    }
    setIsInCall(false);
    setIsInConversation(false);
  };

  const handleIncomingCall = useCallback(async (data) => {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }
  
    if (!peer.current || peer.current.destroyed) {
      createPeer(false);  // Apenas cria o peer se ele não foi destruído
    }
  
    peer.current.signal(data);  // Certifique-se de chamar o signal apenas se o peer existir
    setIsInCall(true);
  }, [createPeer]);
  
  socket.current.onmessage = (message) => {
    const data = JSON.parse(message.data);
    
    if (peer.current && !peer.current.destroyed) {
      peer.current.signal(data);  // Certifique-se de que o peer não foi destruído antes de sinalizar
    } else {
      console.log("Peer já foi destruído, sinalização ignorada.");
    }
  };
  

  useEffect(() => {
    const createWebSocket = () => {
      socket.current = new WebSocket('wss://3b85-2804-4dd0-c002-9600-3446-cbdc-6721-6a1c.ngrok-free.app');
  
      socket.current.onopen = () => {
        console.log('WebSocket conectado');
      };
  
      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };
  
      socket.current.onmessage = (message) => {
        if (message && peer.current) {
          const data = JSON.parse(message.data);
          peer.current.signal(data);
        } else {
          console.log('Mensagem recebida, mas o peer não está disponível ou a mensagem é nula.');
        }
      };
  
      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
      };
    };
  
    createWebSocket();
  
    return () => {
      if (socket.current) {
        socket.current.close();
      }
    };
  }, [handleIncomingCall]);
  
  if (socket.current) {
    socket.current.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (peer.current) {
        peer.current.signal(data);
      }
    };
  } else {
    console.error('WebSocket não está inicializado.');
  }
  
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>

      {isInCall && (
        <div className="bg-green-500 text-white p-4 rounded-md">
          <FaPhoneAlt /> Você está em uma chamada!
        </div>
      )}

      <div>
        {!isInCall && (
          <button onClick={startCall} className="bg-blue-500 text-white p-3 rounded-md">
            Iniciar Chamada
          </button>
        )}

        {isInConversation && (
          <div className="mt-4">
            <span>Outra pessoa entrou na chamada</span>
          </div>
        )}
      </div>

      {isInCall && (
        <button onClick={endCall} className="bg-red-500 text-white p-2 mt-4 rounded-md">
          Encerrar Chamada
        </button>
      )}

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default Canais;
