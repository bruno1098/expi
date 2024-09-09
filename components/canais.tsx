import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FaPhoneAlt } from "react-icons/fa";

const Canais = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [isInConversation, setIsInConversation] = useState(false); // Indica se a outra pessoa está conectada
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const socket = useRef<WebSocket | null>(null); // WebSocket para sinalização

  useEffect(() => {
    const createWebSocket = () => {
      socket.current = new WebSocket('wss://websocket-server-app.herokuapp.com');
      
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
        const data = JSON.parse(message.data);
        console.log('Mensagem recebida:', data);
  
        // Suas lógicas para ofertas, respostas e ICE candidates
        if (data.type === 'offer') {
          handleOffer(data.offer);
        } else if (data.type === 'answer') {
          handleAnswer(data.answer);
        } else if (data.type === 'ice-candidate') {
          handleICECandidate(data.candidate);
        }
      };
    };
    const sendMessage = (message: any) => {
        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
          socket.current.send(JSON.stringify(message));
        } else {
          console.log('WebSocket não está aberto');
        }
      };
      

    useEffect(() => {
        const interval = setInterval(() => {
          if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            socket.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);  // Envia um ping a cada 25 segundos
      
        return () => clearInterval(interval);
      }, []);
      
  
    // Chama a função para criar o WebSocket na inicialização
    createWebSocket();
  
    return () => {
      if (socket.current) {
        socket.current.close();
      }
    };
  }, []);
  
  

  // Função para lidar com ofertas WebRTC recebidas
  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
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
  };
  

  // Função para lidar com respostas WebRTC recebidas
  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
  };

  // Função para lidar com candidatos ICE recebidos
  const handleICECandidate = async (candidate: RTCIceCandidateInit | undefined) => {
    await peerConnection.current?.addIceCandidate(new RTCIceCandidate(candidate));
  };

  const createPeerConnection = async () => {
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
  };
  
  // Inicia uma chamada, enviando uma oferta via WebSocket
  const startCall = async () => {
    await createPeerConnection();
  
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
        {/* Lista de Canais de Voz */}
        <div
          className="flex items-center gap-4 p-3 bg-muted rounded-md hover:bg-muted-hover cursor-pointer"
          onClick={startCall}
        >
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
        <div className="flex items-center gap-4 p-3 bg-muted rounded-md hover:bg-muted-hover cursor-pointer">
          <Avatar className="w-10 h-10">
            <AvatarImage src="/icons/channel3.png" alt="Channel 3" />
            <AvatarFallback>C3</AvatarFallback>
          </Avatar>
          <span className="text-lg">Canal de Voz 3</span>
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
