import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaPhoneAlt } from "react-icons/fa";
import Peer from 'simple-peer';

const Canais = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [isInConversation, setIsInConversation] = useState(false);
  const [usersInCall, setUsersInCall] = useState([]); // Lista de usuários conectados
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

      // Adiciona um único "usuário" à chamada se não estiver na lista ainda
      setUsersInCall((prevUsers) => {
        if (!prevUsers.includes('Outro Usuário')) {
          return [...prevUsers, 'Outro Usuário'];
        }
        return prevUsers;
      });
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
    setUsersInCall(['Você']); // Adiciona o usuário local na chamada
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
    setUsersInCall([]); // Limpa a lista de usuários ao encerrar a chamada
  };

  const handleIncomingCall = useCallback(async (data) => {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    if (!peer.current || peer.current.destroyed) {
      createPeer(false);  
    }

    peer.current.signal(data);  
    setIsInCall(true);

    // Garante que o "Outro Usuário" seja adicionado apenas uma vez
    setUsersInCall((prevUsers) => {
      if (!prevUsers.includes('Outro Usuário')) {
        return [...prevUsers, 'Outro Usuário'];
      }
      return prevUsers;
    });
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
    <div className="flex-1 flex flex-col items-center justify-center h-full">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>

      {isInCall && (
        <div className="bg-green-500 text-white p-4 rounded-md">
          <FaPhoneAlt /> Você está em uma chamada!
        </div>
      )}

      {!isInCall && (
        <button onClick={startCall} className="bg-blue-500 text-white p-3 rounded-md">
          Iniciar Chamada
        </button>
      )}

      {/* Exibir usuários conectados */}
      {usersInCall.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6 my-8">
          {usersInCall.map((user, index) => (
            <div key={index} className="flex flex-col items-center mx-4">
              {/* Ícones de usuários */}
              <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center text-white">
                {user[0]}
              </div>
              <span className="mt-2 text-center">{user}</span>
            </div>
          ))}
        </div>
      )}

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
