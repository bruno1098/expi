"use client";
import React, { useState, useRef, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog"; 
import axios from "axios";
import { SettingsIcon, MoreHorizontalIcon } from "lucide-react";
import FeedbackModal from "./FeedbackModal";

type Message = {
  role: "user" | "ai";
  content: string;
};

type Conversation = {
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
    if (!loading && messages.length > 0) {
      const updatedHistory = [...history];
      if (activeConversationIndex !== null) {
        updatedHistory[activeConversationIndex].messages = messages;
      }
      localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));
    }
  }, [history, messages, loading, activeConversationIndex]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const generateTitleFromGPT = async (messages: Message[]): Promise<string> => {
    const conversationText = messages.map(msg => msg.content).join('\n');
    const prompt = `
    Dada a conversa a seguir, gere um título criativo e conciso que resuma o tema ou o tópico principal discutido. O título deve ser uma descrição curta de até 3 palavras e clara, que capture a essência da conversa.

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
    if (newMessages.length === 1 && !currentTitle) {
      const title = await generateTitleFromGPT(newMessages);
      setCurrentTitle(title);
      if (activeConversationIndex !== null) {
        const updatedHistory = [...history];
        updatedHistory[activeConversationIndex] = {
          ...updatedHistory[activeConversationIndex],
          title: title,
          messages: newMessages
        };
        setHistory(updatedHistory);
      } else {
        const newHistory = [...history, { title, messages: newMessages }];
        setHistory(newHistory);
        setActiveConversationIndex(newHistory.length - 1);
      }
    } else {
      if (activeConversationIndex !== null) {
        const updatedHistory = [...history];
        updatedHistory[activeConversationIndex].messages = newMessages;
        setHistory(updatedHistory);
      } else {
        const newHistory = [...history, { title: currentTitle || "Analisando...", messages: newMessages }];
        setHistory(newHistory);
        setActiveConversationIndex(newHistory.length - 1);
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
        saveConversation([...messages, { role: "ai", content: response }]);
      }
    }, 20);
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
      } catch (error) {
        setLoading(false);
      }
    }
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

  const handleNewConversation = () => {
    setMessages([]);
    setCurrentTitle(null);
    setActiveConversationIndex(null);
  };

  const handleDeleteConversation = (index: number) => {
    const updatedHistory = [...history];
    updatedHistory.splice(index, 1);
    setHistory(updatedHistory);
    localStorage.setItem("chatHistory", JSON.stringify(updatedHistory));
  
    if (activeConversationIndex === index) {
      handleNewConversation();
    } else if (activeConversationIndex !== null && activeConversationIndex > index) {
      setActiveConversationIndex(activeConversationIndex - 1);
    }
  };

  const [currentId, setCurrentId] = useState(1);
  const handleOpenFeedbackModal = async () => {
    if (messages.length === 0) {
        setErrorMessage("A conversa deve ter pelo menos uma mensagem antes de ser finalizada.");
        setIsErrorModalOpen(true);
        return;
    }

    const conversationText = messages.map(msg => {
        const role = msg.role === "user" ? "Usuário" : "Chatbot";
        return `${role}: ${msg.content}`;
    }).join('\n');

    const prompt = `
    Considere a seguinte conversa entre o usuário e o chatbot. Faça uma análise detalhada, indicando se o usuário ficou satisfeito com as respostas recebidas, se suas expectativas foram atendidas, e qual o sentimento geral da interação. Seja conciso e claro na sua análise mas nao precisa ser tao detalhista, apenas correto. Não descreve como se fosse uma conversa, tem que ser de forma natural

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

        o Seguinte texto é um feedback e preciso que vc categorize esse feedback como "bom", "ruim", "neutro" ou outra categoria apropriada, apenas com uma unica palavra.
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

        let modalTitle = "Feedback Diverso";
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

        // Preparar o feedback para salvar via API
        const feedbackData = {
          id: currentId, // Incrementa o ID a cada chamada
          usuario: "admin", // Pode mudar futuramente para o usuário autenticado
          comentario: analysis,
          rating: categoryResult,
          data: new Date().toISOString(), // Adiciona a data atual no formato ISO
        };
        setCurrentId(currentId + 1);

        // Enviar o feedback para a API (que irá salvar no Firebase)
        const apiResponse = await axios.post("/api/feedback", feedbackData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("Feedback enviado com sucesso:", apiResponse.data);

    } catch (error) {
        console.error("Erro ao enviar feedback:", error);
        setFeedbackAnalysis("Erro ao realizar a análise.");
        setModalTitle("Erro na Análise");
        setTitleColor("text-red-500");
    }

    setIsFeedbackModalOpen(true);
};

  const handleCloseFeedbackModal = () => {
    setIsFeedbackModalOpen(false);
    setFeedbackAnalysis(null);
  };
  return (
    <div className="flex flex-col h-screen">
      <header className="bg-primary text-primary-foreground py-4 px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Avatar className="w-8 h-8">
            <AvatarImage src="/logo.png" alt="Chatbot" />
            <AvatarFallback>CB</AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-bold">Chatbot</h1>
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
            <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={handleCloseFeedbackModal}
        title={modalTitle}
        titleColor={titleColor}
        feedbackAnalysis={feedbackAnalysis}
      />
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
