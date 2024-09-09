import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaPhoneAlt, FaUserCircle } from "react-icons/fa";
import Peer from 'simple-peer';

const Canais = ({ usersInCall, setUsersInCall }) => {
  const [isInCall, setIsInCall] = useState(false);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const socket = useRef(null);

  // Função para criar o peer
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
      setUsersInCall(prevUsers => [...prevUsers, 'Outro Usuário']); // Adiciona outro usuário na chamada
    });

    peerInstance.on('close', () => {
      endCall();
    });

    peer.current = peerInstance;
  }, [setUsersInCall]);

  // Entrar no canal de voz ao clicar na aba
  const joinChannel = async () => {
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
    setUsersInCall(['Você']); // Adiciona o usuário atual na lista de usuários
  };

  // Sair do canal de voz
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
    setUsersInCall([]); // Reseta os usuários na chamada
  };

  // Quando alguém entra no canal
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
    setUsersInCall(prevUsers => [...prevUsers, 'Outro Usuário']); // Adiciona o outro usuário
  }, [createPeer, setUsersInCall]);

  // Efeito que se ativa ao entrar no canal
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

    // Join the channel on mount
    joinChannel(); // Aqui entra no canal automaticamente

    return () => {
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
      endCall(); // Sair do canal ao desmontar o componente
    };
  }, [handleIncomingCall]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>

      {/* Mostrar se estiver em uma chamada */}
      {isInCall && (
        <div className="bg-green-500 text-white p-4 rounded-md">
          <FaPhoneAlt /> Você está em uma chamada!
        </div>
      )}

      <div className="mt-4">
        {/* Mostrar usuários conectados */}
        {isInCall && usersInCall.length > 0 ? (
          <div>
            {usersInCall.map((user, index) => (
              <div key={index} className="flex items-center gap-4 mt-2">
                <FaUserCircle className="text-gray-700 w-6 h-6" />
                <span>{user}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>Nenhum usuário conectado ainda</p>
        )}
      </div>

      {/* Sair do canal */}
      {isInCall && (
        <button onClick={endCall} className="bg-red-500 text-white p-2 mt-4 rounded-md">
          Sair do Canal
        </button>
      )}

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default Canais;
