import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaUser } from "react-icons/fa";
import Peer from 'simple-peer';
import { ref, get } from "firebase/database";
import { database } from "../pages/api/feedback"; // Certifique-se de importar corretamente o Firebase
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Removendo o Modal, pois ele já está no chat

const Canais = ({ usersInCall, setUsersInCall, userName, setUserName, userId, setIsUserModalOpen }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const socket = useRef(null);

  // Cria o peer para a conexão de áudio
  const createPeer = useCallback((initiator) => {
    const peerInstance = new Peer({
      initiator,
      trickle: false,
      stream: localAudioRef.current.srcObject,
    });

    peerInstance.on('signal', (signalData) => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        const payload = {
          signalData,
          userId,
        };
        socket.current.send(JSON.stringify(payload));
      }
    });
    
    peerInstance.on('connect', () => {
      console.log('Conexão Peer estabelecida com sucesso');
    });
    
    peerInstance.on('error', (err) => {
      console.error('Erro na conexão Peer:', err);
    });
    
    peerInstance.on('stream', async (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setIsInCall(true);

      const otherUserName = await getUserNameFromFirebase(userId);
      setUsersInCall((prevUsers) => {
        if (!prevUsers.includes(otherUserName)) {
          return [...prevUsers, otherUserName];
        }
        return prevUsers;
      });
    });

    peerInstance.on('close', () => {
      setIsInCall(false);
    });

    peer.current = peerInstance;
  }, [setUsersInCall, userId]);

  // Entrar em um canal de voz
  const enterVoiceChannel = async (channelName) => {
    if (!userName) {
      setIsUserModalOpen(true);
      return;
    }

    setCurrentChannel(channelName);
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      socket.current = new WebSocket('wss://serverexpi.onrender.com/ws');
    
    
      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
      };

      socket.current.onmessage = async (message) => {
        const data = JSON.parse(message.data);

        if (data.signalData) {
          try {
            // Verifica o estado do peer antes de sinalizar
            if (peer.current && peer.current._pc.signalingState === 'stable') {
              console.warn('RTCPeerConnection já está no estado stable. Ignorando sinal.');
            } else {
              peer.current.signal(data.signalData);
            }
          } catch (err) {
            console.error("Erro ao sinalizar o peer:", err);
          }
        }

        if (data.userId) {
          const remoteUserName = await getUserNameFromFirebase(data.userId);
          setUsersInCall((prevUsers) => {
            if (!prevUsers.includes(remoteUserName)) {
              return [...prevUsers, remoteUserName];
            }
            return prevUsers;
          });
        }
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };
    }

    const localUserName = await getUserNameFromFirebase(userId);
    createPeer(true);
    setUsersInCall((prevUsers) => [...prevUsers, localUserName]);
  };

  // Sair de um canal de voz
  const leaveVoiceChannel = () => {
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
    }

    if (socket.current) {
      socket.current.close();
      socket.current = null;
    }

    setUsersInCall((prevUsers) => prevUsers.filter((user) => user !== userName));
    setIsInCall(false);
    setCurrentChannel(null);
  };

  // Lida com chamadas de entrada
  const handleIncomingCall = useCallback(async (data) => {
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    if (!peer.current || peer.current.destroyed) {
      createPeer(false);
    }

    if (navigator.mediaDevices && typeof RTCPeerConnection !== 'undefined') {
      console.warn('RTCPeerConnection já está no estado stable. Ignorando sinal.');
    } else {
      peer.current.signal(data.signalData);
    }

    const remoteUserName = await getUserNameFromFirebase(data.userId);

    setIsInCall(true);
    setUsersInCall((prevUsers) => {
      if (!prevUsers.includes(remoteUserName)) {
        return [...prevUsers, remoteUserName];
      }
      return prevUsers;
    });
  }, [createPeer, setUsersInCall]);

  // Configura o WebSocket ao montar o componente
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

  // Busca o nome de usuário do Firebase
  const getUserNameFromFirebase = async (userId) => {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        return snapshot.val().name;
      } else {
        console.error("Usuário não encontrado no Firebase");
        return "Outro Usuário";
      }
    } catch (error) {
      console.error("Erro ao buscar o nome do usuário:", error);
      return "Outro Usuário";
    }
  };

  // Renderiza os canais de voz
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full bg-background text-foreground">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>
  
      <div className="w-full max-w-md bg-background rounded-md p-4">
        <h3 className="text-lg font-semibold mb-2">Canais</h3>
        <ul className="space-y-2">
          <li
            className={`flex flex-col items-start p-2 rounded cursor-pointer bg-muted ${currentChannel === 'Tudo que eu quero' ? 'bg-primary' : ''}`}
            onClick={() => (isInCall ? leaveVoiceChannel() : enterVoiceChannel('Tudo que eu quero'))}
          >
            <span className="text-foreground">Tudo que eu quero</span>
  
            {currentChannel === 'Tudo que eu quero' && usersInCall.length > 0 && (
              <ul className="pl-4 pt-2 space-y-1">
                {usersInCall.map((user, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <FaUser className="text-muted-foreground" />
                    <span>{user === 'self' ? userName : user}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
  
          <li
            className={`flex flex-col items-start p-2 rounded cursor-pointer bg-muted ${currentChannel === 'Meu Plug me traz' ? 'bg-primary' : ''}`}
            onClick={() => (isInCall ? leaveVoiceChannel() : enterVoiceChannel('Meu Plug me traz'))}
          >
            <span className="text-foreground">Meu Plug me traz</span>
  
            {currentChannel === 'Meu Plug me traz' && usersInCall.length > 0 && (
              <ul className="pl-4 pt-2 space-y-1">
                {usersInCall.map((user, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <FaUser className="text-muted-foreground" />
                    <span>{user === 'self' ? userName : user}</span>
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
