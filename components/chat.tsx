"use client";
import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import  Modal  from "@/components/ui/Modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveConversationToFirebase, deleteConversationFromFirebase, getNextConversationId, getNextFeedbackId } from "../pages/api/feedback"; // Importa as funções do arquivo feedback.js


import axios from "axios";
import { SettingsIcon, MoreHorizontalIcon } from "lucide-react";


type Message = {
  role: "user" | "ai";
  content: string;
};

type Conversation = {
  id: number; // Adiciona a propriedade 'id'
  title: string;
  messages: Message[];
};

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
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


const client = axios.create({
  baseURL: "https://api.openai.com/v1",
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
});





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
    const data = {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user" as const, content: promptText }],
    };

    try {
      const result = await client.post("/chat/completions", data);
      const response = result.data.choices[0].message.content;

      const newMessages: Message[] = [
        ...messages,
        { role: "user", content: promptText },
        { role: "ai", content: "" }
      ];

      setMessages(newMessages);
      setInputValue("");
      setTimeout(() => handleTypeEffect(response), 1000);

      // Salvar a conversa após a primeira mensagem
      await saveConversation(newMessages);
    } catch (error) {
      setLoading(false);
    }
  }
};

const handleTypeEffect = (response: string) => {
  let index = 0;
  const intervalId = setInterval(() => {
    setMessages((currentMessages) => {
      const newMessages = [...currentMessages];
      const lastMessage = newMessages[newMessages.length - 1];

      if (lastMessage && lastMessage.role === "ai") {
        lastMessage.content = response.substring(0, index + 1);
        return [...newMessages];
      } else {
        clearInterval(intervalId);
        return currentMessages;
      }
    });

    index++;
    if (index >= response.length) {
      clearInterval(intervalId);
      setLoading(false);
      // Salva a conversa com a resposta gerada pela IA
      saveConversation([...messages, { role: "ai", content: response }]);
    }
  }, 20);
};


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

    // Verifica se a conversa que foi excluída era a ativa, se sim, inicia uma nova conversa
    if (activeConversationIndex !== null) {
      if (activeConversationIndex === index) {
        handleNewConversation();
      } else if (activeConversationIndex > index) {
        setActiveConversationIndex(activeConversationIndex - 1);
      }
    }
  } catch (error) {
    console.error("Erro ao excluir conversa no Firebase:", error);
    // Exibir uma mensagem de erro ao usuário
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

  Conversa:
  ${conversationText}
  `;

  try {
    const response = await client.post("/chat/completions", {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Você é um assistente útil que analisa feedbacks de conversas." },
        { role: "user", content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const analysis = response.data.choices[0].message.content.trim();

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
      usuario: "admin",
      comentario: analysis,
      rating: categoryResult,
      data: new Date().toISOString(),
    };

    // Enviar o feedback completo para a API
    const apiResponse = await axios.post("/api/feedback", feedbackData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("Feedback enviado com sucesso:", apiResponse.data);

    // Desativar o estado de carregamento
    setModalLoading(false);

  } catch (error) {
    console.error("Erro ao enviar feedback:", error);
    setModalTitle("Erro na Análise");
    setTitleColor("text-red-500");
    setModalLoading(false);
  }
};

const handleCloseFeedbackModal = () => {
  setIsFeedbackModalOpen(false);
  setModalLoading(false); // Garantir que o carregamento seja redefinido ao fechar
};

  return (  <div className="flex flex-col h-screen">
    <header className="bg-primary text-primary-foreground py-4 px-6 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <Avatar className="w-8 h-8">
          <AvatarImage src="/logo.png" alt="Chatbot" />
          <AvatarFallback>CB</AvatarFallback>
        </Avatar>
        <h1 className="text-xl font-bold">Expi</h1>
      </div>
      <Button onClick={handleNewConversation} variant="ghost" className="p-2 rounded-full">
        Nova Conversa
      </Button>
    </header>
    <div className="flex-1 flex overflow-hidden">
      <div className="w-64 border-r bg-background flex-shrink-0 flex flex-col">
        <Tabs defaultValue="history" className="h-full flex flex-col">
          <TabsList className="border-b">
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="history" className="p-4 overflow-auto flex-1">
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
                        <DropdownMenuItem onClick={() => handleDeleteConversation(index)}>Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground">Nenhuma conversa ainda</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="settings" className="p-4 overflow-auto flex-1">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="theme">Tema</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>Light</span>
                      <ChevronDownIcon className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>Claro</DropdownMenuItem>
                    <DropdownMenuItem>Escuro</DropdownMenuItem>
                    <DropdownMenuItem>Sistema</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="language">Language</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      <span>English</span>
                      <ChevronDownIcon className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem>English</DropdownMenuItem>
                    <DropdownMenuItem>Español</DropdownMenuItem>
                    <DropdownMenuItem>Français</DropdownMenuItem>
                    <DropdownMenuItem>Deutsch</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sound">Som</Label>
                <Switch id="sound" aria-label="Sound" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-6 overflow-auto">
          <div className="grid gap-4">
            {messages.map((message, index) => (
              <div key={index} className={`flex items-start gap-4 ${message.role === "user" ? "justify-end" : ""}`}>
                {message.role === "ai" && (
                  <Avatar className="w-10 h-10">
                    <AvatarImage src="/logo.png" alt="Chatbot" />
                    <AvatarFallback>CB</AvatarFallback>
                  </Avatar>
                )}
                <div className={`p-4 rounded-lg max-w-[80%] ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  <p>{message.content}</p>
                </div>
                {message.role === "user" && (
                  <Avatar className="w-10 h-10">
                    <AvatarImage src="/user.png" alt="User" />
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-center">
                <p>Digitando...</p>
              </div>
            )}
          </div>
          <div ref={messageEndRef} />
        </div>
        <div className="border-t p-4 flex items-center justify-between sticky bottom-0 bg-background">
          <Textarea
            placeholder="Digite sua mensagem..."
            className="flex-1 mr-4 resize-none"
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
  isLoading={modalLoading} // Use modalLoading aqui
>
  <p>{feedbackAnalysis || "Seu feedback foi enviado com sucesso!"}</p>
</Modal>


        </div>
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
