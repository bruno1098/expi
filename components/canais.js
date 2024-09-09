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

    if (!socket.current) {
      socket.current = new WebSocket('wss://serverexpi.onrender.com/ws');

      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
      };

      socket.current.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (peer.current) {
          peer.current.signal(data);
        }
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
        endCall();
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };
    }

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
      socket.current = null;
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

  useEffect(() => {
    if (!socket.current) {
      socket.current = new WebSocket('wss://serverexpi.onrender.com/ws');

      socket.current.onopen = () => {
        console.log('Esperando por chamadas...');
      };

      socket.current.onmessage = (message) => {
        const data = JSON.parse(message.data);
        handleIncomingCall(data);
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
      };
    }

    return () => {
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
    };
  }, [handleIncomingCall]);

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
