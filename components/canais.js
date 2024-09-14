import React, { useState, useRef, useEffect, useCallback } from "react";
import { FaUser } from "react-icons/fa";
import Peer from 'simple-peer';
import { ref, set, get, runTransaction } from "firebase/database";
import { database } from "../pages/api/feedback"; 
import { Button } from "@/components/ui/button";
import { v4 as uuidv4 } from 'uuid';
import axios from "axios";

const Canais = ({ usersInCall, setUsersInCall, userName, setUserName, userId, setIsUserModalOpen }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const peer = useRef(null);
  const socket = useRef(null);
  const callSessionIdRef = useRef(null);
  const [conversationTranscript, setConversationTranscript] = useState([]);
  const client = axios.create({
    baseURL: "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  // Inicializa o WebSocket apenas uma vez
  useEffect(() => {
    if (!socket.current) {
      socket.current = new WebSocket('wss://serverexpi.onrender.com/ws');

      socket.current.onopen = () => {
        console.log('Conexão WebSocket estabelecida');
      };

      socket.current.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        console.log("Mensagem recebida no WebSocket:", data);

        if (data.userId !== userId) {
          if (data.signalData) {
            handleIncomingCall(data);
          }
        }
      };

      socket.current.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
      };

      socket.current.onclose = () => {
        console.log('WebSocket desconectado');
        socket.current = null;
      };
    }

    return () => {
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
    };
  }, [userId]);

  // Limpar o callSessionId ao fechar a aba ou atualizar a página
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const channelRef = ref(database, `channels/${currentChannel}`);
      await set(channelRef, null);
      console.log("Sessão encerrada devido a atualização ou fechamento da aba.");
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentChannel]);

  const createPeer = useCallback((initiator, signalData = null) => {
    const peerInstance = new Peer({
      initiator,
      trickle: false,
      stream: localAudioRef.current.srcObject,
    });

    peerInstance.on('signal', (signal) => {
      if (socket.current && socket.current.readyState === WebSocket.OPEN) {
        const payload = { signalData: signal, userId };
        socket.current.send(JSON.stringify(payload));
      }
    });

    peerInstance.on('stream', (stream) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = stream;
      }
      setIsInCall(true);
    });

    peerInstance.on('error', (err) => {
      console.error("Erro no peer:", err);
    });

    peerInstance.on('close', () => {
      setIsInCall(false);
    });

    if (signalData) {
      peerInstance.signal(signalData);
    }

    peer.current = peerInstance;
  }, [userId]);

  const enterVoiceChannel = async (channelName) => {
    if (!userName) {
      setIsUserModalOpen(true);
      return;
    }

    setCurrentChannel(channelName);

    const callSessionId = uuidv4();
    const channelRef = ref(database, `channels/${channelName}`);
    await set(channelRef, { callSessionId });
    callSessionIdRef.current = callSessionId;

    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ userId, joined: true }));
    }

    if (usersInCall.length === 0) {
      createPeer(true);
    }

    setUsersInCall((prevUsers) => [...prevUsers, userName]);
  };

  const leaveVoiceChannel = async () => {
    if (peer.current) {
      peer.current.destroy();
      peer.current = null;
    }

    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(JSON.stringify({ userId, left: true }));
    }

    setIsInCall(false);
    setUsersInCall([]);
    const channelRef = ref(database, `channels/${currentChannel}`);
    await set(channelRef, null);

    callSessionIdRef.current = null;
    setCurrentChannel(null);

    // Analisar a conversa com o GPT
    analyzeConversation();
  };

  const handleIncomingCall = useCallback(async (data) => {
    if (!peer.current) {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }
      createPeer(false, data.signalData);
    } else {
      peer.current.signal(data.signalData);
    }
  }, [createPeer]);

  const analyzeConversation = async () => {
    if (conversationTranscript.length === 0) {
      console.log("Sem conversa para analisar.");
      return;
    }

    const conversationText = conversationTranscript.join('\n');
    const prompt = `
    Dada a conversa a seguir, identifique quem é o cliente e quem é o atendente com base em palavras-chave, e faça uma análise do sentimento geral.
    Determine se o cliente está satisfeito com o atendimento e se o atendente foi eficiente. Baseado nisso, gere um feedback final.

    Conversa:
    ${conversationText}

    Feedback:
    `;

    try {
      const response = await client.post("/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Você é um assistente que analisa conversas de atendimento." },
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const feedback = response.data.choices[0].message.content.trim();
      console.log("Feedback gerado:", feedback);

      // Salvar o feedback no Firebase
      const feedbackRef = ref(database, `ura/${callSessionIdRef.current}/feedback`);
      await set(feedbackRef, {
        feedback,
        timestamp: Date.now(),
      });

    } catch (error) {
      console.error("Erro ao gerar feedback:", error);
    }
  };

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
        </ul>
      </div>

      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  );
};

export default Canais;
