import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaPhoneAlt, FaUserCircle } from "react-icons/fa";
import Peer from 'simple-peer';

const Canais = ({ usersInCall, setUsersInCall }) => {
  const [isInCall, setIsInCall] = useState(false);
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
  }, [setUsersInCall]);

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
  }, [createPeer, setUsersInCall]);

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

      {usersInCall.length > 0 && (
        <div className="bg-green-500 text-white p-4 rounded-md">
          <span>Você está em uma chamada!</span>
        </div>
      )}

      <div className="mt-4">
        {usersInCall.length > 0 ? (
          <div>
            {usersInCall.map((user, index) => (
              <div key={index} className="flex items-center gap-4 mt-2">
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  {/* Ícone do usuário */}
                  <span className="text-black font-bold">{user[0]}</span>
                </div>
                <span>{user}</span>
              </div>
            ))}
          </div>
        ) : (
          <p>Nenhum usuário conectado ainda</p>
        )}
      </div>

      <button onClick={() => setUsersInCall([])} className="bg-red-500 text-white p-2 mt-4 rounded-md">
        Sair do Canal
      </button>
    </div>
  );
};

export default Canais;
