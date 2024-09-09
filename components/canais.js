import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaPhoneAlt, FaUserCircle } from "react-icons/fa";
import Peer from 'simple-peer';

const Canais = ({ usersInCall, setUsersInCall }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [usersInCall, setUsersInCall] = useState([]); // Lista de usuários na chamada
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const socket = useRef(null);

  useEffect(() => {
    // Simulando usuários entrando na chamada
    const newUsers = ["Outro Usuário", "Você"];
    setUsersInCall(newUsers);
  }, [setUsersInCall]);
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
    setUsersInCall(['Você']); // Adiciona o usuário atual na lista de usuários
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
    setUsersInCall([]); // Reseta os usuários na chamada
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
    setUsersInCall(['Outro Usuário']); // Adiciona o outro usuário ao iniciar a chamada
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

      <div className="mt-4">
        {isInCall && (
          <div className="flex flex-col items-start space-y-4">
            {usersInCall.map((user, index) => (
              <div key={index} className="flex items-center space-x-2">
                <FaUserCircle size={24} />
                <span>{user}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isInCall && (
        <div>
          <button onClick={startCall} className="bg-blue-500 text-white p-3 rounded-md">
            Entrar no Canal
          </button>
        </div>
      )}

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
