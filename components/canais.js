import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaUser } from "react-icons/fa";
import Peer from 'simple-peer';

const Canais = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null); // Canal atual
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
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify(data));
      } else {
        console.log('WebSocket ainda não está pronto para enviar dados.');
      }
    });

    peerInstance.on('stream', (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setIsInCall(true);

      // Adiciona o outro usuário na lista se não estiver
      setUsersInCall((prevUsers) => {
        if (!prevUsers.includes('Outro Usuário')) {
          return [...prevUsers, 'Outro Usuário'];
        }
        return prevUsers;
      });
    });

    peerInstance.on('close', () => {
      setIsInCall(false);
    });

    peer.current = peerInstance;
  }, []);

  const enterVoiceChannel = async (channelName) => {
    setCurrentChannel(channelName); // Define o canal atual

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
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };
    }

    createPeer(true);
    setUsersInCall((prevUsers) => ['Você', ...prevUsers]); // Adiciona o usuário local no canal
  };

  const leaveVoiceChannel = () => {
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
    }

    if (socket.current) {
      socket.current.close();
      socket.current = null;
    }

    // Remove o usuário local da lista
    setUsersInCall((prevUsers) => prevUsers.filter((user) => user !== 'Você'));
    setIsInCall(false);
    setCurrentChannel(null); // Remove o canal atual
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
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-gray-900 text-white">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>

      <div className="w-full max-w-md bg-gray-800 rounded-md p-4">
        <h3 className="text-lg font-semibold mb-2">Canais</h3>
        <ul className="space-y-2">
          {/* Canal 1 */}
          <li
            className={`flex flex-col items-start p-2 bg-gray-700 rounded cursor-pointer ${currentChannel === 'Tudo que eu quero' ? 'bg-gray-600' : ''}`}
            onClick={() => (isInCall ? leaveVoiceChannel() : enterVoiceChannel('Tudo que eu quero'))}
          >
            <span>Tudo que eu quero</span>
            {/* Exibir usuários conectados ao clicar no canal */}
            {currentChannel === 'Tudo que eu quero' && usersInCall.length > 0 && (
              <ul className="pl-4 pt-2 space-y-1">
                {usersInCall.map((user, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <FaUser className="text-gray-300" />
                    <span>{user}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>

          {/* Canal 2 */}
          <li
            className={`flex flex-col items-start p-2 bg-gray-700 rounded cursor-pointer ${currentChannel === 'Meu Plug me traz' ? 'bg-gray-600' : ''}`}
            onClick={() => (isInCall ? leaveVoiceChannel() : enterVoiceChannel('Meu Plug me traz'))}
          >
            <span>Meu Plug me traz</span>
            {/* Exibir usuários conectados ao clicar no canal */}
            {currentChannel === 'Meu Plug me traz' && usersInCall.length > 0 && (
              <ul className="pl-4 pt-2 space-y-1">
                {usersInCall.map((user, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <FaUser className="text-gray-300" />
                    <span>{user}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </div>

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default Canais;
