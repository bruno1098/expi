import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaUserCircle } from "react-icons/fa";
import Peer from 'simple-peer';

const Canais = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [usersInChannel, setUsersInChannel] = useState([]);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const socket = useRef(null);
  const messageQueue = useRef([]); // Fila de mensagens enquanto o WebSocket não está pronto

  const sendMessage = (message) => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify(message));
    } else {
      // Armazenar na fila se o WebSocket ainda não estiver pronto
      messageQueue.current.push(message);
    }
  };

  const createPeer = useCallback((initiator) => {
    const peerInstance = new Peer({
      initiator,
      trickle: false,
      stream: localAudioRef.current.srcObject,
    });

    peerInstance.on('signal', (data) => {
      sendMessage(data); // Usar a função de envio com checagem
    });

    peerInstance.on('stream', (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    });

    peerInstance.on('close', () => {
      leaveChannel();
    });

    peer.current = peerInstance;
  }, []);

  const joinChannel = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    if (!socket.current) {
      socket.current = new WebSocket('wss://serverexpi.onrender.com/ws');

      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
        setIsConnected(true);

        // Enviar todas as mensagens acumuladas na fila
        while (messageQueue.current.length > 0) {
          const queuedMessage = messageQueue.current.shift();
          sendMessage(queuedMessage);
        }
      };

      socket.current.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.type === "user-joined") {
          setUsersInChannel(prevUsers => [...prevUsers, data.username]);
        } else if (data.type === "signal") {
          if (peer.current) {
            peer.current.signal(data.signal);
          }
        }
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
        leaveChannel();
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };
    }

    createPeer(true);
  };

  const leaveChannel = () => {
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
    }
    if (socket.current) {
      socket.current.close();
      socket.current = null;
    }
    setIsConnected(false);
    setUsersInChannel([]);
  };

  useEffect(() => {
    joinChannel();

    return () => {
      leaveChannel();
    };
  }, [createPeer]);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>

      <div>
        {isConnected ? (
          <div className="bg-green-500 text-white p-4 rounded-md">
            <span>Você está no canal de voz!</span>
            <div className="mt-4">
              <h3 className="text-lg">Pessoas no canal:</h3>
              <div className="flex gap-2 mt-2">
                {usersInChannel.map((user, index) => (
                  <div key={index} className="flex items-center">
                    <FaUserCircle size={24} />
                    <span className="ml-2">{user}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-gray-500">Conectando ao canal de voz...</span>
        )}
      </div>

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default Canais;
