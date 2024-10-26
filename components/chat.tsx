"use client";
import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveConversationToFirebase, deleteConversationFromFirebase, getNextConversationId, getNextFeedbackId, getNextUserId, saveUserToFirebase } from "../pages/api/feedback"; // Importa as funções do arquivo feedback.js
// Importar o componente GPTVoiceChat
import GPTVoiceChat from './gpt'; // Certifique-se de ajustar o caminho conforme necessário
import TutorialExpi from './TutorialExpi'; // Supondo que o arquivo Tutorial.tsx esteja na mesma pasta
import TutorialVoice from './TutorialVoice'; // Supondo que o arquivo Tutorial.tsx esteja na mesma pasta

import axios from "axios";
import { SettingsIcon, MoreHorizontalIcon } from "lucide-react";
import Canais from "./canais";
import { ref, set } from "firebase/database";
import GptChat from "./gpt";
import { FaRegSmile, FaRegMeh, FaRegFrown, FaRegLaughBeam, FaRegSadTear } from 'react-icons/fa';

import { FiSend, FiMessageSquare, FiUser } from "react-icons/fi";

import { useTypewriter as useTypewriterEffect } from 'react-simple-typewriter';

import Sentiment from "sentiment";
import { AnimatePresence, motion, useAnimation } from "framer-motion";
import { Smiley, SmileyMeh, SmileySad, SmileyWink, SmileyXEyes } from "phosphor-react";



type Message = {
  role: "user" | "ai";
  content: string;
};

// Definição do tipo VoiceMessage em chat.tsx
type GptMessage = {
  senderId: string;
  senderName: string;
  content: string;
};




type Conversation = {
  id: number; // Adiciona a propriedade 'id'
  title: string;
  messages: Message[];
};

// types.ts
export type VoiceMessage = {
  senderId: string;
  senderName: string;
  content: string;
};




export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]); // Novo estado para mensagens de voz
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Conversation[]>([]);
  const [currentTitle, setCurrentTitle] = useState<string | null>(null);
  const [activeConversationIndex, setActiveConversationIndex] = useState<number | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackAnalysis, setFeedbackAnalysis] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("Feedback");
  const [titleColor, setTitleColor] = useState("text-gray-800");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [usersInCall, setUsersInCall] = useState([]);
  const [inputUserName, setInputUserName] = useState('');
  const [inputEmail, setInputEmail] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const [wordCloudData, setWordCloudData] = useState<{ text: string; value: number }[]>([]);
  const [currentSentiment, setCurrentSentiment] = useState<number | null>(null);

  const [typewriterText] = useTypewriterEffect({
    words: ['Digitando...'],
    loop: 0,
    typeSpeed: 70,
  });
  const sentimentAnalyzer = new Sentiment();
  
  
  const updateWordCloud = (text: string) => {
    const words = text.toLowerCase().split(/\s+/);
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      if (word.length > 3) {
        wordCount[word] = (wordCount[word] || 0) + 1;
      }
    });
    const newCloudData = Object.entries(wordCount).map(([text, value]) => ({ text, value }));
    setWordCloudData(prevData => {
      const combinedData = [...prevData, ...newCloudData];
      const mergedData = combinedData.reduce((acc, curr) => {
        const existing = acc.find(item => item.text === curr.text);
        if (existing) {
          existing.value += curr.value;
        } else {
          acc.push(curr);
        }
        return acc;
      }, [] as { text: string; value: number }[]);
      return mergedData.sort((a, b) => b.value - a.value).slice(0, 7); // Limita a 7 palavras mais frequentes
    });
  };

  

  // Carregar o nome e o tema salvos no localStorage na inicialização
  useEffect(() => {
    // Verifica se há uma preferência de tema salva no localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Se não houver tema salvo, usa a preferência do sistema
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(systemPrefersDark);
    }

    // Carregar o nome de usuário salvo no localStorage
    const savedUserName = localStorage.getItem('userName');
    if (savedUserName) {
      setUserName(savedUserName);
    }
  }, []);

  // Efeito para aplicar o tema e salvar no localStorage
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // Função para alternar o tema
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };


 
  const client = axios.create({
    baseURL: "https://api.openai.com/v1",
    headers: {
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });


  useEffect(() => {
    // Carregar o nome do usuário e o ID do sessionStorage
    const savedUserName = sessionStorage.getItem("userName") ?? ""; // Garantir que nunca seja null
    const savedUserId = sessionStorage.getItem("userId") ?? ""; // Garantir que nunca seja null

    setUserName(savedUserName);
    setUserId(savedUserId);
  }, []);

  useEffect(() => {
    console.log('userName in Canais:', userName);
  }, [userName]);


  const handleSaveUserName = async () => {
    if (inputUserName.trim() === "") {
      alert("Por favor, insira um nome válido.");
      return;
    }

    try {
      // Obter o próximo ID único para o usuário
      const newUserId = await getNextUserId();

      // Salvar o usuário no Firebase
      await saveUserToFirebase(newUserId, inputUserName);

      // Salvar o nome e ID do usuário no sessionStorage
      sessionStorage.setItem("userName", inputUserName);
      sessionStorage.setItem("userId", newUserId);

      // Atualizar o estado do userName com o valor do input
      setUserName(inputUserName);
      setUserId(newUserId);
      setIsUserModalOpen(false); // Fecha o modal
    } catch (error) {
      console.error("Erro ao salvar o usuário:", error);
    }
  };




  useEffect(() => {
    const savedHistory = localStorage.getItem("chatHistory");
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    if (!loading && messages.length > 0 && activeConversationIndex !== null) {
      const updatedHistory = [...history];
      updatedHistory[activeConversationIndex].messages = messages;
      localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));

      // Atualizar a conversa existente no Firebase
      const conversationId = updatedHistory[activeConversationIndex].id;
      const conversationData = {
        title: currentTitle,
        messages,
      };
      saveConversationToFirebase(conversationId, conversationData);
    }
  }, [history, messages, loading, activeConversationIndex]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateTitleFromGPT = async (messages: Message[]): Promise<string> => {
    const conversationText = messages.map(msg => msg.content).join('\n');
    const prompt = `
  Dada a conversa a seguir, gere um título criativo e conciso que resuma o tema ou o tópico principal discutido. 
  O título deve ser uma descrição curta de até 4 palavras e clara, que capture a essência da conversa.

  Conversa:
  ${conversationText}

  Título:
  `;

    try {
      const response = await client.post("/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Você é um assistente útil que gera títulos descritivos e concisos para conversas." },
          { role: "user", content: prompt }
        ],
        max_tokens: 7,
        temperature: 0.8,
      });

      const title = response.data.choices[0].message.content.trim();
      return title || "Carregando...";
    } catch (error) {
      return "Erro ao gerar título";
    }
  };

   const controls = useAnimation();


   const analyzeSentimentGPT = async (messages: Message[]): Promise<number> => {
    const conversationText = messages.map(msg => msg.content).join('\n');
    const prompt = `
      Analise o sentimento geral da seguinte conversa e classifique-o em uma escala de -1 a 1, 
      onde -1 é muito negativo, 0 é neutro e 1 é muito positivo. Retorne **apenas** o número, sem nenhum outro texto.
  
      Conversa:
      ${conversationText}
  
      Sentimento:
    `;
  
    try {
      const response = await client.post("/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Você é um analisador de sentimentos preciso." },
          { role: "user", content: prompt }
        ],
        max_tokens: 5, // Aumentado de 1 para 5
        temperature: 0.3,
      });
  
      const sentimentText = response.data.choices[0].message.content.trim();
      console.log("Resposta do GPT para Sentimento:", sentimentText); // Adicionado para depuração
  
      // Extraia o número usando regex para capturar possíveis formatos como -0.5, 0, 0.3, etc.
      const sentimentMatch = sentimentText.match(/-?\d+(\.\d+)?/);
      const sentiment = sentimentMatch ? parseFloat(sentimentMatch[0]) : 0;
  
      return isNaN(sentiment) ? 0 : sentiment;
    } catch (error) {
      console.error("Erro ao analisar sentimento:", error);
      return 0;
    }
  };
  


  
  
  


  const handleTypeEffect = async (response: string) => {
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 50)); // Ajuste este valor para controlar a velocidade
      setMessages(currentMessages => {
        const newMessages = [...currentMessages];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === "ai") {
          lastMessage.content = words.slice(0, i + 1).join(' ');
        }
        return newMessages;
      });
    }
    setLoading(false);
    await saveConversation([...messages, { role: "ai", content: response }]);
  };
  const TypingIndicator = () => (
    <motion.div
      className="flex items-center space-x-2 text-gray-400"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.span
        className="w-2 h-2 bg-gray-400 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "loop" }}
      />
      <motion.span
        className="w-2 h-2 bg-gray-400 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "loop", delay: 0.1 }}
      />
      <motion.span
        className="w-2 h-2 bg-gray-400 rounded-full"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "loop", delay: 0.2 }}
      />
    </motion.div>
  );
  const saveConversation = async (newMessages: Message[]) => {
    let updatedHistory: Conversation[] = history ? [...history] : [];

    if (activeConversationIndex === null) {
      // Criar uma nova conversa apenas uma vez
      const title = await generateTitleFromGPT(newMessages);
      setCurrentTitle(title);

      // Obter o próximo ID único para a nova conversa
      const newConversationId = await getNextConversationId();

      const newConversation: Conversation = {
        id: newConversationId,
        title,
        messages: newMessages,
      };

      updatedHistory = [...updatedHistory, newConversation];
      setHistory(updatedHistory);
      setActiveConversationIndex(updatedHistory.length - 1);

      // Salvar a nova conversa no Firebase
      await saveConversationToFirebase(newConversation.id, newConversation);
    } else {
      // Atualiza a conversa existente com as novas mensagens
      const updatedConversation = updatedHistory[activeConversationIndex];
      updatedConversation.messages = [...updatedConversation.messages, ...newMessages];

      setHistory(updatedHistory);

      const conversationData = {
        title: updatedConversation.title,
        messages: updatedConversation.messages,
      };
      await saveConversationToFirebase(updatedConversation.id, conversationData);
    }
  };

  const handleSubmit = async () => {
    const promptText = inputValue.trim();
    if (promptText) {
      setLoading(true);
      setIsTyping(true);
  
      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: promptText },
      ];
      setMessages(newMessages);
      updateWordCloud(promptText);
  
      const systemMessage = {
        role: "system",
        content: "Você é um atendente virtual de uma loja online chamada 'Loja expi'. Sua função é ajudar os clientes com informações sobre produtos, preços, disponibilidade, pedidos, entregas e políticas da loja. Seja sempre educado, profissional e prestativo."
      };
  
      const apiMessages = [
        systemMessage,
        ...newMessages.map((msg) => ({
          role: msg.role === "ai" ? "assistant" as const : msg.role,
          content: msg.content,
        })),
      ];
  
      const data = {
        model: "gpt-3.5-turbo",
        messages: apiMessages,
      };
  
      try {
        const result = await client.post("/chat/completions", data);
        const response = result.data.choices[0].message.content;
  
        setIsTyping(false);
        
        // Iniciar a animação de digitação
        await handleTypeEffect(response);
  
        const updatedMessages: Message[] = [...newMessages, { role: "ai", content: response }];
        setMessages(updatedMessages);
        updateWordCloud(response);
  
        // Analisar sentimento após cada mensagem
        const newSentiment = await analyzeSentimentGPT(updatedMessages);
        setCurrentSentiment(newSentiment);
  
        // Animar a barra de sentimento
        controls.start({ width: `${(newSentiment + 1) * 50}%` });
  
        setInputValue("");
        await saveConversation(updatedMessages);
      } catch (error) {
        console.error("Erro ao processar a mensagem:", error);
      } finally {
        setLoading(false);
        setIsTyping(false);
      }
    }
  };
  
  // const handleSubmit = async () => {
  //   const promptText = inputValue.trim();
  //   if (promptText) {
  //     setLoading(true);
  
  //     // Adicionar a nova mensagem do usuário ao histórico de mensagens
  //     const newMessages: Message[] = [
  //       ...messages,
  //       { role: "user", content: promptText },
  //     ];

  //     const systemMessage = {
  //       role: "system",
  //       content: "Você é um atendente virtual de uma loja online chamada 'Loja expi'. Sua função é ajudar os clientes com informações sobre produtos, preços, disponibilidade, pedidos, entregas e políticas da loja. Seja sempre educado, profissional e prestativo."
  //     };

  //     // Mapear as mensagens para o formato esperado pela API do OpenAI
  //     const apiMessages = [
  //       systemMessage,
  //       ...newMessages.map((msg) => ({
  //         role: msg.role === "ai" ? "assistant" : msg.role,
  //         content: msg.content,
  //       })),
  //     ];
  
  //     const data = {
  //       model: "gpt-3.5-turbo",
  //       messages: apiMessages,
  //     };
  
  //     try {
  //       const result = await client.post("/chat/completions", data);
  //       const response = result.data.choices[0].message.content;
  
  //       // Adicionar a resposta do assistente às mensagens
  //       const updatedMessages: Message[] = [
  //         ...newMessages,
  //         { role: "ai", content: "" },
  //       ];
  
  //       setMessages(updatedMessages);
  //       setInputValue("");
  //       setTimeout(() => handleTypeEffect(response), 1000);
  
  //       // Salvar a conversa com a resposta gerada pela IA
  //       await saveConversation([
  //         ...newMessages,
  //         { role: "ai", content: response },
  //       ]);
  //     } catch (error) {
  //       setLoading(false);
  //     }
  //   }
  // };
  
  




  const handleKeyDown = (event: { key: string; shiftKey: any; preventDefault: () => void; }) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectConversation = (index: number) => {
    const selectedConversation = history[index];
    if (selectedConversation) {
      setMessages([...selectedConversation.messages]);
      setCurrentTitle(selectedConversation.title);
      setActiveConversationIndex(index);
    }
  };

  const handleDeleteConversation = async (index: number) => {
    const conversationId = history[index].id; // Obtém o ID da conversa que será excluída

    try {
      // Excluir a conversa do Firebase
      await deleteConversationFromFirebase(conversationId);
      console.log("Conversa excluída com sucesso do Firebase!");

      // Se a exclusão no Firebase for bem-sucedida, atualiza o estado local
      const updatedHistory = [...history];
      updatedHistory.splice(index, 1);
      setHistory(updatedHistory);

      // Atualizar o localStorage após a exclusão
      localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));

      // Verifica se a conversa que foi excluída era a ativa
      if (activeConversationIndex !== null) {
        if (activeConversationIndex === index) {
          // Se a conversa ativa foi excluída, inicia uma nova conversa
          handleNewConversation();
        } else if (activeConversationIndex > index) {
          // Se a conversa ativa estava após a excluída, ajusta o índice
          setActiveConversationIndex(activeConversationIndex - 1);
        }
      }
    } catch (error) {
      console.error("Erro ao excluir conversa no Firebase:", error);
      // Exibir uma mensagem de erro ao usuário
      setErrorMessage("Erro ao excluir conversa. Tente novamente.");
      setIsErrorModalOpen(true);
    }
  };



  const handleNewConversation = () => {
    setMessages([]);
    setCurrentTitle(null);
    setActiveConversationIndex(null);
    console.log("Nova conversa iniciada");
  };




  const handleOpenFeedbackModal = async () => {
    if (messages.length === 0) { 
      setErrorMessage("A conversa deve ter pelo menos uma mensagem antes de ser finalizada.");
      setIsErrorModalOpen(true);
      return;
    }
    
    if (!sessionStorage.getItem("userEmail")) {
      setErrorMessage("Por favor, insira seu e-mail antes de finalizar a conversa.");
      setIsErrorModalOpen(true);
      return;
    }
  
    setModalLoading(true); // Ativar o estado de carregamento
    setIsFeedbackModalOpen(true); // Abrir o modal imediatamente
  
    const conversationText = messages.map(msg => {
      const role = msg.role === "user" ? "Usuário" : "Chatbot";
      return `${role}: ${msg.content}`;
    }).join('\n');
  
    const prompt = `
      Considere a seguinte conversa entre o usuário e o chatbot. 
  
      Faça uma análise de sentimento vendo se o chatbot se saiu bem, indicando se o usuário ficou satisfeito com as respostas recebidas, 
      se suas expectativas foram atendidas, qual o sentimento geral da interação, e se o chatbot foi eficiente.
      Como um adendo, diga o que pode ser melhorado nesse chatbot.

      mantenha sempre um padrão com os seguintes tópicos:
      Satisfação do Usuário:
      Expectativas Atendidas:
      Sentimento Geral: 
      Melhoria:
      
      deixe essa analise em formato HTML.
      Use as tags <strong> para destacar as partes importantes, e <p> para separar parágrafos e outras tags necessarias, deixe os titulos maiores para mais destaque.

      remova no começo o conteudo "html" do começo com os 3 pontinhos antes e depois, nao esqueça disso

      seja bem direto e tente usar no maximo 100 palavras

  
      Conversa:
      ${conversationText}
    `;
  
    try {
      // Análise de sentimento
      const response = await client.post("/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Você é um assistente útil que analisa feedbacks de conversas." },
          { role: "user", content: prompt }
        ],
        max_tokens: 180,
        temperature: 0.5,
      });
  
      const analysis = response.data.choices[0].message.content.trim();
      const emailSubject = `EXPI - Feedback da sua conversa: ${currentTitle}`;
  
      const emailHtml = `
<!DOCTYPE html>
<html dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">

<head>
    <meta charset="UTF-8">
    <meta content="width=device-width, initial-scale=1" name="viewport">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta content="telephone=no" name="format-detection">
    <title>Feedback da sua Conversa</title>
    <!--[if (mso 16)]>
    <style type="text/css">
    a {text-decoration: none;}
    </style>
    <![endif]-->
    <!--[if gte mso 9]><style>sup { font-size: 100% !important; }</style><![endif]-->
    <!--[if !mso]><!-- -->
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap" rel="stylesheet">
    <!--<![endif]-->
    <style>
        body, p, h1, h2, h3, h4, h5, h6, pre {
            font-family: 'Manrope', sans-serif;
            color: #ffffff !important; /* Texto sempre em branco */
        }
            .opinion-title {
            font-family: 'Horizon';
            color: #ffffff !important;
            font-size: 38px !important;
            line-height: 1.2;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            font-style: bold;
        }
        a {
            text-decoration: none;
            color: #ffffff !important; /* Links em branco */
        }
        .es-wrapper {
            background-color: #314B70;
            background-image: url('https://expi-five.vercel.app/background.png');
            background-repeat: repeat-y;
            background-size: 100% auto;
            background-position: top center;
        }
        .es-content-body {
            background-color: transparent;
        }
        h1 {
            font-size: 40px !important;
            line-height: 1.2;
        }
        h2 {
            font-size: 28px !important;
            line-height: 1.3;
        }
        p {
            font-size: 16px !important;
            line-height: 1.5;
        }
        .es-header-logo img {
            display: block;
            margin: 0 auto;
        }
        .es-footer-body {
            background-color: #222;
            padding: 40px 20px;
        }
        .footer-icon {
            width: 24px;
            margin: 0 10px;
            display: inline-block;
        }
        .footer-socials {
            display: flex;
            justify-content: center;
            margin-top: 15px;
        }
        .footer-text {
            font-size: 14px;
            text-align: center;
            color: #cccccc;
            margin-top: 20px;
        }
    </style>
</head>


<body>
    <div dir="ltr" class="es-wrapper-color">
        <table class="es-wrapper" width="100%" cellspacing="0" cellpadding="0">
            <tbody>
                <tr>
                    <td class="esd-email-paddings" valign="top">
                        <!-- Cabeçalho -->
                        <table cellpadding="0" cellspacing="0" class="es-header esd-header-popover" align="center">
                            <tbody>
                                <tr>
                                    <td class="esd-stripe" align="center">
                                        <table bgcolor="transparent" class="es-header-body" align="center" cellpadding="0" cellspacing="0" width="600" style="background-color: transparent;">
                                            <tbody>
                                                <tr>
                                                    <td class="es-p20t es-p20r es-p20l esd-structure" align="left">
                                                        <table cellpadding="0" cellspacing="0" width="100%">
                                                            <tbody>
                                                                <tr>
                                                                    <td width="560" class="esd-container-frame" align="center" valign="top">
                                                                        <table cellpadding="0" cellspacing="0" width="100%">
                                                                            <tbody>
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-image es-header-logo" style="font-size: 0px;">
                                                                                        <a target="_blank" href="https://plusoft-expi.vercel.app">
                                                                                            <img src="https://github.com/bruno1098/expi/blob/main/public/logo.png?raw=true" alt="Logo" style="display: block;" height="80" title="Logo">
                                                                                        </a>
                                                                                    </td>
                                                                                </tr>
                                                                                <!-- Espaçamento adicional para centralizar o header -->
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-spacer" height="20"></td>
                                                                                </tr>
                                                                                <!-- Emojis ou imagens adicionais -->
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-image es-p15b" style="font-size: 0px;">
                                                                                        <a target="_blank" href="#">
                                                                                            <img src="https://tlr.stripocdn.email/content/guids/CABINET_dd9759b09de82ede623cff0b42f718ca19c0a4f85f6337f81c705fd693708d47/images/bluebubblelikebuttoniconthumbsuplikesignfeedbackconceptwhitebackground3drendering.png" alt="" style="display: block;" width="60">
                                                                                        </a>
                                                                                    </td>
                                                                                </tr>
                                                                                <!-- Título principal -->
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-text es-p25b" style="letter-spacing: 5px">
                                                                                        <p style="font-size: 14px;">FEEDBACK DA SUA CONVERSA</p>
                                                                                    </td>
                                                                                </tr>
                                                                                 <tr>
        <td align="center" class="esd-block-text es-p40b">
            <h1>
                <span class="opinion-title">Sua Opinião Importa para Nós</span>
            </h1>
        </td>
    </tr>
                                                                                <!-- Conteúdo principal -->
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-text es-p40b es-p40r es-p40l es-m-p0r es-m-p0l">
                                                                                        <p><strong>Título da Conversa:</strong></p>
                                                                                        <h2 class="analysis-title">${currentTitle}</h2> <!-- Título da conversa ajustado -->
                                                                                        <p><strong>Análise da interação:</strong></p>
                                                                                        ${analysis}
                                                                                    </td>
                                                                                </tr>
                                                                                <!-- Transcrição da Conversa -->
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-text es-p20t es-p30b es-p15r es-p15l es-m-p0r es-m-p0l">
                                                                                        <h2>Transcrição da Conversa:</h2>
                                                                                        <pre>${conversationText}</pre>
                                                                                    </td>
                                                                                </tr>
                                                                                <!-- Seção "Tem alguma pergunta?" após a transcrição -->
                                                                                <tr>
                                                                                    <td class="esd-structure es-p30t es-p30b es-p20r es-p20l esdev-adapt-off" align="left" background="https://tlr.stripocdn.email/content/guids/CABINET_beef27fd72bf04f5ec347afb3c9242a7a6cb9763af3e70ce8481235882b7a5b6/images/rectangle_5445.png" style="background-image: url('https://tlr.stripocdn.email/content/guids/CABINET_beef27fd72bf04f5ec347afb3c9242a7a6cb9763af3e70ce8481235882b7a5b6/images/rectangle_5445.png'); background-repeat: no-repeat; background-position: center center;">
                                                                                        <table width="560" cellpadding="0" cellspacing="0" class="esdev-mso-table">
                                                                                            <tbody>
                                                                                                <tr>
                                                                                                    <td class="esdev-mso-td" valign="top">
                                                                                                        <table cellpadding="0" cellspacing="0" class="es-left" align="left">
                                                                                                            <tbody>
                                                                                                                <tr>
                                                                                                                    <td width="223" class="esd-container-frame" align="left">
                                                                                                                        <table cellpadding="0" cellspacing="0" width="100%">
                                                                                                                            <tbody>
                                                                                                                                <tr>
                                                                                                                                    <td align="right" class="esd-block-image" style="font-size: 0px;">
                                                                                                                                        <a target="_blank" href="#">
                                                                                                                                            <img class="adapt-img" src="https://tlr.stripocdn.email/content/guids/CABINET_beef27fd72bf04f5ec347afb3c9242a7a6cb9763af3e70ce8481235882b7a5b6/images/32226255_m001t0311_a_message_01sep22.png" alt="" style="display: block;" width="100">
                                                                                                                                        </a>
                                                                                                                                    </td>
                                                                                                                                </tr>
                                                                                                                            </tbody>
                                                                                                                        </table>
                                                                                                                    </td>
                                                                                                                </tr>
                                                                                                            </tbody>
                                                                                                        </table>
                                                                                                    </td>
                                                                                                    <td width="20"></td>
                                                                                                    <td class="esdev-mso-td" valign="top">
                                                                                                        <table cellpadding="0" cellspacing="0" class="es-right" align="right">
                                                                                                            <tbody>
                                                                                                                <tr>
                                                                                                                    <td width="317" align="left" class="esd-container-frame">
                                                                                                                        <table cellpadding="0" cellspacing="0" width="100%">
                                                                                                                            <tbody>
                                                                                                                                <tr>
                                                                                                                                    <td align="left" class="esd-block-text es-p20t es-p20b">
                                                                                                                                        <p>Tem alguma pergunta?<br><a target="_blank" href="https://plusoft-expi.vercel.app">Entre em contato com nossa equipe</a></p>
                                                                                                                                    </td>
                                                                                                                                </tr>
                                                                                                                            </tbody>
                                                                                                                        </table>
                                                                                                                    </td>
                                                                                                                </tr>
                                                                                                            </tbody>
                                                                                                        </table>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </td>
                                                                                </tr>
                                                                                <!-- Espaçamento adicional -->
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-spacer" height="20"></td>
                                                                                </tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </td>
                                                                </tr>
                                                                <!-- Outros conteúdos podem ser adicionados aqui -->
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <!-- Rodapé -->
                                                <tr>
                                                    <td class="esd-structure es-p40t es-p40b es-p20r es-p20l" align="left" background="https://expi-five.vercel.app/background.png" style="background-image: url('https://expi-five.vercel.app/background.png'); background-repeat: no-repeat; background-position: center bottom;">
                                                          <table cellpadding="0" cellspacing="0" width="100%">
                                                            <tbody>
                                                                <tr>
                                                                    <td width="560" align="left" class="esd-container-frame">
                                                                        <table cellpadding="0" cellspacing="0" width="100%">
                                                                            <tbody>
                                                                               
                                                                                <!-- Linha separadora -->
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-spacer es-p20" style="font-size:0">
                                                                                        <table border="0" width="65%" height="100%" cellpadding="0" cellspacing="0">
                                                                                            <tbody>
                                                                                                <tr>
                                                                                                    <td style="border-bottom: 1px solid #ffffff; background: unset; height: 1px; width: 100%; margin: 0px;"></td>
                                                                                                </tr>
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </td>
                                                                                </tr>
                                                                                <!-- Texto de agradecimento -->
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-text es-p15t es-p40b">
                                                                                        <p>Obrigado por usar nosso serviço!</p>
                                                                                        <p>Este e-mail foi enviado automaticamente, por favor, não responda.</p>
                                                                                        <p>Visite nosso site: <a href="https://plusoft-expi.vercel.app" target="_blank">https://plusoft-expi.vercel.app</a></p>
                                                                                    </td>
                                                                                </tr>
                                                                                <!-- Logo adicional no rodapé, se desejar -->
                                                                                <!--
                                                                                <tr>
                                                                                    <td align="center" class="esd-block-image es-infoblock made_with" style="font-size:0">
                                                                                        <a target="_blank" href="#">
                                                                                            <img src="https://expi-five.vercel.app/logo.png" alt="" width="125" style="display: block;">
                                                                                        </a>
                                                                                    </td>
                                                                                </tr>
                                                                                -->
                                                                            </tbody>
                                                                        </table>
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <!-- Fim do Rodapé -->
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <!-- Fim do conteúdo principal -->
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</body>

</html>

`;



  
      // Enviar e-mail com a análise
      await axios.post('/api/sendEmail', {
        to: sessionStorage.getItem("userEmail"),
        subject: emailSubject,
        text: `Aqui está o feedback da sua conversa:
  
  Título da Conversa: ${currentTitle}
  
  Análise:
  ${analysis}
  
  Conversa:
  ${conversationText}`,
        html: emailHtml,
      });
  
      // Categorizar o feedback
      const categorizationPrompt = `
        Dado o seguinte feedback:
  
        "${analysis}"
  
        O seguinte texto é um feedback de uma inteligência artificial sobre uma conversa. Preciso que você 
        categorize essa conversa como "Bom", "Ruim", "Neutro", "Insatisfeito" 
        apenas com uma única dessas palavras E MAIS NENHUMA OUTRA. Analise e use sentimentos para categorizar de forma mais assertiva possível.
      `;
      
      const categorizationResponse = await client.post("/chat/completions", {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "Você é um assistente útil que categoriza feedbacks." },
          { role: "user", content: categorizationPrompt }
        ],
        max_tokens: 50,
        temperature: 0.7,
      });
  
      const categoryResult = categorizationResponse.data.choices[0].message.content.trim();
  
      let modalTitle = "Feedback";
      let titleColor = "text-yellow-500";
  
      if (categoryResult.toLowerCase().includes("bom")) {
        modalTitle = "Feedback Positivo";
        titleColor = "text-green-500";
      } else if (categoryResult.toLowerCase().includes("ruim")) {
        modalTitle = "Feedback Negativo";
        titleColor = "text-red-500";
      } else if (categoryResult.toLowerCase().includes("neutro")) {
        modalTitle = "Feedback Neutro";
        titleColor = "text-gray-500";
      }
  
      setModalTitle(modalTitle);
      setTitleColor(titleColor);
  
      // Obter o próximo ID único para o feedback
      const feedbackId = await getNextFeedbackId();
  
      // Preparar o feedback para salvar via API
      const feedbackData = {
        id: feedbackId,
        usuario: sessionStorage.getItem("userEmail"),
        comentario: analysis,
        rating: categoryResult,
        data: new Date().toISOString(),
      };
  
      // Enviar o feedback completo para a API
      await axios.post("/api/feedback", feedbackData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      console.log("Feedback enviado com sucesso!");
      
      // Desativar o estado de carregamento
      setModalLoading(false);
  
    } catch (error) {
      console.error("Erro ao enviar feedback e e-mail:", error);
      setModalTitle("Erro na Análise");
      setTitleColor("text-red-500");
      setModalLoading(false);
    }
  };
  
  

  const handleCloseFeedbackModal = () => {
    setIsFeedbackModalOpen(false);
    setModalLoading(false); // Garantir que o carregamento seja redefinido ao fechar
  };

 
  // Função para adicionar mensagens de voz

  const addVoiceMessage = (message: VoiceMessage) => {
    setVoiceMessages((prevMessages) => [...prevMessages, message]);
  };

  const [gptMessages, setGptMessages] = useState<GptMessage[]>([]);

  // Função para atualizar as mensagens
  const handleMessagesUpdate = (updatedMessages: React.SetStateAction<GptMessage[]>) => {
    setGptMessages(updatedMessages);
  };

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [voiceMessages, messageEndRef]);

// Tutorial states
const [isTutorialOpen, setIsTutorialOpen] = useState(false);
const [tutorialType, setTutorialType] = useState<string | null>(null);

// Definir o tipo Tab como a união das strings
type Tab = 'voicechat' | 'gptvoice' | 'history' | 'modoescu';

// Estado para controlar se os tutoriais de cada aba já foram exibidos
const [tutorialShown, setTutorialShown] = useState<Record<Tab, boolean>>({
  voicechat: false,
  gptvoice: false,
  history: false,
  modoescu: false
});

// Definir o selectedTab como sendo do tipo Tab
const [selectedTab, setSelectedTab] = useState<Tab>('history');
// Definir o selectedTab explicitamente como sendo do tipo Tab

// UseEffect para abrir o tutorial quando a aba mudar, se ainda não foi mostrado
useEffect(() => {
  if (!tutorialShown[selectedTab]) {
    switch (selectedTab) {
      case 'voicechat':
        setIsTutorialOpen(true);
        setTutorialType('voicechat');
        setTutorialShown((prev) => ({ ...prev, voicechat: true })); // Marca o tutorial como exibido
        break;
      case 'gptvoice':
        setIsTutorialOpen(true);
        setTutorialType('gptvoice');
        setTutorialShown((prev) => ({ ...prev, gptvoice: true }));
        break;
      case 'history':
        setIsTutorialOpen(true);
        setTutorialType('history');
        setTutorialShown((prev) => ({ ...prev, history: true }));
        break;
      case 'modoescu':
        setIsTutorialOpen(true);
        setTutorialType('modoescu');
        setTutorialShown((prev) => ({ ...prev, modoescu: true }));
        break;
      default:
        setIsTutorialOpen(false);
        setTutorialType(null);
        break;
    }
  }
}, [selectedTab, tutorialShown]); // Dispara quando selectedTab ou tutorialShown mudam


const [emailError, setEmailError] = useState('');

  const verifyEmail = async (email: string) => {
    const apiKey = process.env.NEXT_PUBLIC_ABSTRACT_API_KEY;// Adicione sua chave API ao .env.local
    const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${apiKey}&email=${email}`;

    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error('Erro ao verificar e-mail:', error);
      return null;
    }
  };

  const handleSaveUserEmail = async () => {
    setEmailError('');
    if (inputEmail.trim() === "") {
      setEmailError("Por favor, insira um e-mail válido.");
      return;
    }

    try {
      const result = await verifyEmail(inputEmail);
      
      if (!result) {
        setEmailError("Não foi possível verificar o e-mail. Tente novamente mais tarde.");
        return;
      }

      if (result.deliverability === "UNDELIVERABLE") {
        setEmailError("Este e-mail parece não ser válido ou não existe.");
        return;
      }

      if (result.is_disposable_email.value) {
        setEmailError("Por favor, use um e-mail não descartável.");
        return;
      }

      // Se chegou até aqui, o e-mail é considerado válido
      const newUserId = await getNextUserId();
      sessionStorage.setItem("userEmail", inputEmail);
      sessionStorage.setItem("userId", newUserId);
      setUserName(inputEmail);
      setUserId(newUserId);
      setIsUserModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar o e-mail:", error);
      setEmailError("Ocorreu um erro ao verificar o e-mail. Tente novamente.");
    }
  };
  

  return (
    <div className="flex flex-col h-screen">
      {/* Verifica se algum tutorial está ativo e exibe */}
      {isTutorialOpen && tutorialType === 'voicechat' && (
        <TutorialVoice onClose={() => setIsTutorialOpen(false)} />
      )}
      
      {isTutorialOpen && tutorialType === 'history' && (
        <TutorialExpi onClose={() => setIsTutorialOpen(false)} />
      )}
      
      {/* Cabeçalho com o botão de nova conversa */}
      <header className="bg-primary text-primary-foreground py-4 px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Avatar className="w-8 h-8">
            <AvatarImage src="/logo.png" alt="Chatbot" />
            <AvatarFallback>CB</AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold">Expi</h1>
        </div>
  
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8 cursor-pointer" onClick={() => setIsUserModalOpen(true)}>
            <AvatarImage src="/user.png" alt="User" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <p className="text-sm">
            {userName ? `Olá, ${userName}` : "Insira seu e-mail"}
          </p>
        </div>
        <Button onClick={handleNewConversation} variant="ghost" className="p-2 rounded-full">
          Nova Conversa
        </Button>
      </header>
  
      {/* Modal para o usuário inserir o e-mail */}
      {isUserModalOpen && (
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title="Insira seu e-mail"
        isLoading={modalLoading}
      >
        <Input
          placeholder="Seu e-mail"
          value={inputEmail}
          onChange={(e) => setInputEmail(e.target.value)}
        />
        {emailError && <p className="text-red-500 mt-2">{emailError}</p>}
        <Button onClick={handleSaveUserEmail}>Salvar</Button>
      </Modal>
      )}
  
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar com Abas */}
        <div className="w-80 border-r bg-background flex-shrink-0 flex flex-col h-full">
        <Tabs defaultValue="history" className="flex-1 flex flex-col h-full" onValueChange={(value) => {
          if (["voicechat", "gptvoice", "history", "modoescu"].includes(value)) {
            setSelectedTab(value as Tab);
          }
        }}>
          <TabsList className="border-b flex overflow-x-auto w-full">
            <TabsTrigger value="history" className="min-w-max text-center px-2 py-2">
                Expi
            </TabsTrigger>
            <TabsTrigger value="voicechat" className="min-w-max text-center px-2 py-2">
                Voice Chat
            </TabsTrigger>
            <TabsTrigger value="gptvoice" className="min-w-max text-center px-2 py-2">
                Expi Express
            </TabsTrigger>
            <TabsTrigger value="modoescu" className="min-w-max text-center px-2 py-2">
                Configs
            </TabsTrigger>
          </TabsList>
  
          <TabsContent value="voicechat" className="flex-1 p-4 overflow-auto">
            <Canais
              usersInCall={usersInCall}
              setUsersInCall={setUsersInCall}
              userName={userName}
              userId={userId}
              setUserName={setUserName}
              setIsUserModalOpen={setIsUserModalOpen}
              addVoiceMessage={addVoiceMessage}
            />
          </TabsContent>
  
          <TabsContent value="gptvoice" className="flex-1 p-4 overflow-auto">
            <GptChat userName={userName} userId={userId} onMessagesUpdate={handleMessagesUpdate} />
          </TabsContent>
  
          <TabsContent value="modoescu" className="flex-1 p-4 overflow-auto">
            <button
              onClick={toggleTheme}
              className="p-2 bg-primary text-primary-foreground rounded-lg"
            >
              {isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
            </button>
          </TabsContent>
  
          <TabsContent value="history" className="flex-1 p-4 overflow-auto">
            <div className="p-4 border-b">
              <Input placeholder="Search conversations" className="w-full" />
            </div>
            <div className="p-4 overflow-auto flex-1">
              {history.length > 0 ? (
                history.map((conversation, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-md hover:bg-muted cursor-pointer">
                    <div className="flex items-center gap-4" onClick={() => handleSelectConversation(index)}>
                      <Avatar className="w-10 h-10">
                        <AvatarImage src="/user.png" alt="User" />
                        <AvatarFallback>H</AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-medium">{conversation.title}</h4>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="p-2 rounded-full">
                          <MoreHorizontalIcon className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleDeleteConversation(index)}>
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground">Nenhuma conversa ainda</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
  
        {/* Área de Conteúdo Principal */}
        <div className="flex-1 flex flex-col bg-background h-full">
          {selectedTab === "voicechat" ? (
            <div className="flex flex-col flex-1 p-4 rounded-lg shadow h-full">
              <div className="mb-4">
                <h2 className="text-2xl font-bold">Canais de Voz</h2>
              </div>
  
              {usersInCall && usersInCall.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-6 w-full mb-4">
                  {usersInCall.map((user: string, index: number) => (
                    <div
                      key={index}
                      className="flex flex-col items-center bg-card p-4 rounded-lg shadow w-1/4 min-w-[150px]"
                    >
                      <Avatar className="w-16 h-16 bg-primary-foreground text-primary">
                        <AvatarImage src="/user.png" alt={`User ${index}`} />
                        <AvatarFallback>{user.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="mt-2 text-center text-foreground">
                        {user === "self" ? userName : user}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground mb-4">Nenhum usuário conectado ainda</p>
              )}
  
              <div className="mb-2">
                <h3 className="text-lg font-semibold">Conversa de Voz</h3>
              </div>
  
              <div className="flex-1 overflow-auto p-6">
                <div className="space-y-4 pb-12">
                  {voiceMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex items-start ${
                        message.senderId === userId ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.senderId !== userId && (
                        <div className="flex items-center mr-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src="/user.png" alt={message.senderName} />
                            <AvatarFallback>
                              {message.senderName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="ml-2 text-sm">
                            {message.senderName}
                          </span>
                        </div>
                      )}
                      <div
                        className={`p-2 rounded-md max-w-md ${
                          message.senderId === userId
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        <p>{message.content}</p>
                      </div>
                      {message.senderId === userId && (
                        <div className="flex items-center ml-2">
                          <span className="mr-2 text-sm">{userName}</span>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src="/user.png" alt={userName} />
                            <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messageEndRef} />
                </div>
              </div>
  
              <div className="border-t p-4 bg-background">
                {/* Elementos estáticos aqui, se necessário */}
              </div>
  
            </div>
          ) : selectedTab === "gptvoice" ? (
            <div className="flex flex-col flex-1 p-4 rounded-lg shadow overflow-auto">
              <h2 className="text-2xl font-bold mb-4 text-center">Conversa com Expi Express</h2>
  
              <div className="w-full max-w-2xl mx-auto bg-background rounded-md p-4 mt-6 overflow-y-auto h-full">
                <h3 className="text-lg font-semibold mb-2 text-center">Conversa de Voz</h3>
                <div className="space-y-4">
                  {gptMessages.map((message, index) => (
                    <div key={index} className={`flex items-start ${message.senderId === userId ? 'justify-end' : 'justify-start'}`}>
                      {message.senderId !== userId && (
                        <div className="flex items-center mr-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src="/logo.png" alt={message.senderName} />
                            <AvatarFallback>{message.senderName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="ml-2 text-sm">{message.senderName}</span>
                        </div>
                      )}
                      <div className={`p-2 rounded-md max-w-xs ${message.senderId === userId ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                        <p>{message.content}</p>
                      </div>
                      {message.senderId === userId && (
                        <div className="flex items-center ml-2">
                          <span className="mr-2 text-sm">{userName}</span>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src="/user.png" alt={userName} />
                            <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                    </div>
                  ))}
  
                  {isLoading && (
                    <div className="flex items-center justify-start mt-4">
                      <div className="loader"></div>
                      <span className="ml-2">Aguardando resposta...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
           <div className="flex-1 p-6 overflow-auto">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex items-start gap-4 mb-4 ${message.role === "user" ? "justify-end" : ""}`}
            >
              {message.role === "ai" && (
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src="/logo.png" alt="Chatbot" />
                    <AvatarFallback><FiMessageSquare /></AvatarFallback>
                  </Avatar>
                </motion.div>
              )}
              <motion.div
                className={`p-4 rounded-lg max-w-[80%] ${
                  message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <p>{message.content}</p>
              </motion.div>
              {message.role === "user" && (
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src="/user.png" alt="User" />
                    <AvatarFallback><FiUser /></AvatarFallback>
                  </Avatar>
                </motion.div>
              )}
            </motion.div>
          ))}
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-start mb-4"
            >
              <TypingIndicator />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messageEndRef} />
      </div>
{/* Visualização de Sentimentos */}
<div className="p-4 border-t">
  <h3 className="text-lg font-semibold mb-2">Sentimento da Conversa</h3>
  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 relative">
    {currentSentiment !== null ? (
      <motion.div 
        className="h-2.5 rounded-full"
        style={{
          backgroundColor: currentSentiment > 0 ? '#4CAF50' : currentSentiment < 0 ? '#F44336' : '#FFC107',
        }}
        initial={{ width: "50%" }}
        animate={{ 
          width: `${(currentSentiment + 1) * 50}%`,
          backgroundColor: [
            currentSentiment > 0 ? '#4CAF50' : currentSentiment < 0 ? '#F44336' : '#FFC107',
            currentSentiment > 0.3 ? '#2E7D32' : currentSentiment < -0.3 ? '#C62828' : '#FFA000'
          ]
        }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
    ) : (
      <div className="text-center text-sm text-gray-500">Sentimento indisponível</div>
    )}
  </div>
  <div className="flex justify-between mt-2">
    <motion.div
      animate={{ 
        scale: currentSentiment !== null && currentSentiment < -0.3 ? [1, 1.2, 1] : 1,
        rotate: currentSentiment !== null && currentSentiment < -0.3 ? [0, -10, 0, 10, 0] : 0
      }}
      transition={{ duration: 0.5, repeat: currentSentiment !== null && currentSentiment < -0.3 ? Infinity : 0, repeatDelay: 1 }}
    >
      {currentSentiment !== null && currentSentiment < -0.3 ? (
        <FaRegSadTear size={24} color="#C62828" />
      ) : currentSentiment !== null && currentSentiment < 0 ? (
        <FaRegFrown size={24} color="#F44336" />
      ) : (
        <FaRegMeh size={24} color="#FFC107" />
      )}
    </motion.div>
    <motion.div
      animate={{ 
        scale: currentSentiment !== null && currentSentiment > 0.3 ? [1, 1.2, 1] : 1,
        rotate: currentSentiment !== null && currentSentiment > 0.3 ? [0, -10, 0, 10, 0] : 0
      }}
      transition={{ duration: 0.5, repeat: currentSentiment !== null && currentSentiment > 0.3 ? Infinity : 0, repeatDelay: 1 }}
    >
      {currentSentiment !== null && currentSentiment > 0.3 ? (
        <FaRegLaughBeam size={24} color="#2E7D32" />
      ) : currentSentiment !== null && currentSentiment > 0 ? (
        <FaRegSmile size={24} color="#4CAF50" />
      ) : (
        <FaRegMeh size={24} color="#FFC107" />
      )}
    </motion.div>
  </div>
  {currentSentiment !== null && (
    <motion.p 
      className="mt-2 text-sm text-center"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {currentSentiment > 0.3 ? "Muito Positivo" : 
       currentSentiment > 0 ? "Levemente Positivo" :
       currentSentiment < -0.3 ? "Muito Negativo" : 
       currentSentiment < 0 ? "Levemente Negativo" : "Neutro"}
    </motion.p>
  )}
</div>
  
              {/* Nuvem de Palavras Simplificada */}
              <div className="p-4 border-t">
                <h3 className="text-lg font-semibold mb-2">Palavras Mais Frequentes</h3>
                <div className="flex flex-wrap gap-2">
                  {wordCloudData.slice(0, 20).map((word, index) => (
                    <span 
                      key={index} 
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full"
                      style={{ fontSize: `${Math.max(12, Math.min(24, 12 + word.value * 2))}px` }}
                    >
                      {word.text}
                    </span>
                  ))}
                </div>
              </div>
  
              <div className="border-t p-4 flex items-center justify-between sticky bottom-0 bg-background">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  className="flex-1 mr-4 resize-none h-12"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <Button onClick={handleSubmit}>
                  <SendIcon className="w-5 h-5" />
                </Button>
                <Button onClick={handleOpenFeedbackModal} variant="outline" className="ml-2">
                  Finalizar Conversa
                </Button>
                <Modal
                  isOpen={isFeedbackModalOpen}
                  onClose={handleCloseFeedbackModal}
                  title={modalTitle}
                  isLoading={modalLoading}
                >
                  <p>{feedbackAnalysis || "Seu feedback foi enviado com sucesso!"}</p>
                </Modal>

                <Modal
  isOpen={isErrorModalOpen}
  onClose={() => setIsErrorModalOpen(false)}
  title="Erro"
  isLoading={false}
>
  <p>{errorMessage}</p>
</Modal>
                
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );


}

function ChevronDownIcon(props: React.JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}



function SendIcon(props: React.JSX.IntrinsicAttributes & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}
function useTypewriter(arg0: { words: string[]; loop: number; typeSpeed: number; }): [any] {
  throw new Error("Function not implemented.");
}

