import React, { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FaPhoneAlt } from "react-icons/fa";

const Canais = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [isInConversation, setIsInConversation] = useState(false); // Indica se a outra pessoa está conectada
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socket = useRef<WebSocket | null>(null); // WebSocket para sinalização

  // Função para lidar com ofertas WebRTC recebidas
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnection.current) {
      await createPeerConnection();
    }

    await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.current?.createAnswer();
    await peerConnection.current?.setLocalDescription(answer);

    socket.current?.send(JSON.stringify({
      type: 'answer',
      answer
    }));
  }, []);

  // Função para lidar com respostas WebRTC recebidas
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
  }, []);

  // Função para lidar com candidatos ICE recebidos
  const handleICECandidate = useCallback(async (candidate: RTCIceCandidateInit | undefined) => {
    if (candidate) {
      await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  // Criar a conexão WebRTC
  const createPeerConnection = useCallback(async () => {
    if (!peerConnection.current) {
      const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
      peerConnection.current = new RTCPeerConnection(configuration);

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }

      localStream.getTracks().forEach((track) => {
        peerConnection.current?.addTrack(track, localStream);
      });

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.current?.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate
          }));
        }
      };

      peerConnection.current.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
        }
        setIsInConversation(true); // Outro usuário entrou na chamada
      };

      setIsInCall(true);
    }
  }, []);

  useEffect(() => {
    const createWebSocket = () => {
      socket.current = new WebSocket('ws://localhost:8080'); // Substituir pela URL do seu servidor WebSocket

      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
      };

      socket.current.onclose = () => {
        console.log('WebSocket fechado, tentando reconectar...');
        setTimeout(() => {
          createWebSocket();  // Tenta reconectar após um tempo
        }, 3000);
      };

      socket.current.onmessage = (message) => {
        // Verifique se a mensagem é um blob (áudio)
        if (typeof message.data === 'object' && message.data instanceof Blob) {
          console.log('Áudio recebido como Blob:', message.data);
          // Aqui você pode fazer o que quiser com o blob recebido, como salvá-lo ou processá-lo
        } else {
          // Trata as mensagens de sinalização (WebRTC) como JSON
          try {
            const data = JSON.parse(message.data);
            console.log('Mensagem JSON recebida:', data);
      
            if (data.type === 'offer') {
              handleOffer(data.offer);
            } else if (data.type === 'answer') {
              handleAnswer(data.answer);
            } else if (data.type === 'ice-candidate') {
              handleICECandidate(data.candidate);
            }
          } catch (error) {
            console.error('Erro ao analisar mensagem JSON:', error);
          }
        }
      };
      
    };

    createWebSocket();

    return () => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        socket.current.send(JSON.stringify(onmessage));
      } else {
        console.log('WebSocket ainda está conectando ou já foi fechado.');
      }
    };
  }, [handleOffer, handleAnswer, handleICECandidate]);

  // Inicia uma chamada, enviando uma oferta via WebSocket
  const startCall = async () => {
    await createPeerConnection();
    socket.current = new WebSocket('ws://localhost:8080'); // Substituir pela URL do seu servidor WebSocket

    if (peerConnection.current) {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socket.current?.send(JSON.stringify({
        type: 'offer',
        offer
      }));
    }
  };

  const endCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
      setIsInCall(false);
      setIsInConversation(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-auto">
      <h2 className="text-xl font-bold mb-4">Canais de Voz</h2>

      {isInCall && (
        <div className="p-4 bg-green-500 text-white rounded-md mb-4 flex items-center gap-4">
          <FaPhoneAlt />
          <span>Você está em uma chamada!</span>
        </div>
      )}

      <div className="grid gap-4">
        <div className="flex items-center gap-4 p-3 bg-muted rounded-md hover:bg-muted-hover cursor-pointer" onClick={startCall}>
          <Avatar className="w-10 h-10">
            <AvatarImage src="/icons/channel1.png" alt="Channel 1" />
            <AvatarFallback>C1</AvatarFallback>
          </Avatar>
          <span className="text-lg">Canal de Voz 1</span>
        </div>
        <div className="flex items-center gap-4 p-3 bg-muted rounded-md hover:bg-muted-hover cursor-pointer">
          <Avatar className="w-10 h-10">
            <AvatarImage src="/icons/channel2.png" alt="Channel 2" />
            <AvatarFallback>C2</AvatarFallback>
          </Avatar>
          <span className="text-lg">Canal de Voz 2</span>
        </div>
      </div>

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />

      {isInCall && (
        <div className="flex items-center mt-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src="/icons/user_active.png" alt="Você está em chamada" />
            <AvatarFallback>Você</AvatarFallback>
          </Avatar>
          <span className="ml-2 text-lg">Você está na chamada</span>
        </div>
      )}

      {isInConversation && (
        <div className="flex items-center mt-4">
          <Avatar className="w-10 h-10">
            <AvatarImage src="/icons/user_active.png" alt="Outro usuário" />
            <AvatarFallback>Outra pessoa</AvatarFallback>
          </Avatar>
          <span className="ml-2 text-lg">Outra pessoa entrou na chamada</span>
        </div>
      )}

      {isInCall && (
        <button onClick={endCall} className="mt-4 p-2 bg-red-600 text-white rounded-md">
          Encerrar Chamada
        </button>
      )}
    </div>
  );
};

export default Canais;
