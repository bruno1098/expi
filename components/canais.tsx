import React, { useState, useRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FaPhoneAlt } from "react-icons/fa"; // Ícone para chamada ativa

const Canais = () => {
  const [isInCall, setIsInCall] = useState(false);
  const [isInConversation, setIsInConversation] = useState(false); // Indica se a outra pessoa está conectada
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  
  const startCall = async () => {
    const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    peerConnection.current = new RTCPeerConnection(configuration);

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }

      localStream.getTracks().forEach((track) => {
        if (peerConnection.current) {
          peerConnection.current.addTrack(track, localStream);
        }
      });

      if (peerConnection.current) {
        peerConnection.current.ontrack = (event) => {
          const [remoteStream] = event.streams;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
          setIsInConversation(true); // Alguém entrou na chamada
        };

        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            // Troca de candidatos ICE via servidor de sinalização
            // Enviar o ICE candidate para o outro peer via servidor de WebSocket
          }
        };
      }

      setIsInCall(true); // Atualiza o estado para indicar que está em uma chamada
    } catch (error) {
      console.error("Erro ao iniciar a chamada de voz:", error);
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
