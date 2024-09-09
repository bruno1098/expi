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

  // Função para criar o peer
  const createPeer = useCallback((initiator) => {
    const peerInstance = new Peer({
      initiator,
      trickle: false,
      stream: localAudioRef.current.srcObject, // Usa o áudio local
    });

    // Envia sinal ao outro peer
    peerInstance.on('signal', (data) => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify(data));
      }
    });

    // Recebe stream remoto
    peerInstance.on('stream', (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
    });

    // Quando a conexão fecha
    peerInstance.on('close', () => {
      leaveChannel();
    });

    peer.current = peerInstance;
  }, []);

  // Função para entrar no canal
  const joinChannel = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    // Configura WebSocket
    if (!socket.current) {
      socket.current = new WebSocket('wss://serverexpi.onrender.com/ws');

      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
        setIsConnected(true); // Marca como conectado
      };

      // Recebe mensagens via WebSocket
      socket.current.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.type === "user-joined") {
          setUsersInChannel(prevUsers => [...prevUsers, data.username]); // Adiciona usuário ao canal
        } else if (data.type === "signal") {
          if (peer.current) {
            peer.current.signal(data.signal); // Processa o sinal do outro peer
          }
        }
      };

      // Quando o WebSocket fecha
      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
        leaveChannel();
      };

      // Trata erros
      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };
    }

    // Cria o peer com o iniciador definido
    createPeer(true);
  };

  // Função para sair do canal
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
    setUsersInChannel([]); // Limpa os usuários
  };

  // Usa o efeito para entrar automaticamente no canal ao carregar o componente
  useEffect(() => {
    joinChannel();

    return () => {
      leaveChannel(); // Sai do canal ao desmontar o componente
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
