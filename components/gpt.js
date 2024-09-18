import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'; // Ajuste o caminho conforme necessário

const GptChat = ({ userName, userId, onMessagesUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [isConversationActive, setIsConversationActive] = useState(false); // Novo estado para controlar a conversa
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const recognition = useRef(null);
  const synthesisUtterance = useRef(null); // Referência para controlar a síntese de fala

  // Carregar vozes disponíveis
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      console.log('Vozes disponíveis:', availableVoices); // Log para depuração
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Inicializar o reconhecimento de fala
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('API de reconhecimento de fala não suportada neste navegador.');
      return;
    }

    recognition.current = new SpeechRecognition();
    recognition.current.continuous = true;
    recognition.current.interimResults = false;
    recognition.current.lang = 'pt-BR';

    recognition.current.onresult = async (event) => {
      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript.trim();

      if (transcript) {
        // Adiciona a mensagem do usuário à lista
        addMessage({ senderId: userId, senderName: userName || 'Você', content: transcript });

        // Interrompe o reconhecimento de fala antes de enviar a mensagem
        if (recognition.current) {
          recognition.current.stop();
        }

        // Envia a mensagem para a API da OpenAI
        const response = await sendMessageToGPT(transcript);

        if (response) {
          // Adiciona a resposta do GPT à lista de mensagens
          addMessage({ senderId: 'gpt', senderName: 'Expi', content: response });

          // Adicionar síntese de fala para a resposta do GPT
          if (selectedVoice) {
            console.log('Usando a voz selecionada:', selectedVoice.name); // Log para depuração
            const utterance = new SpeechSynthesisUtterance(response);
            utterance.voice = selectedVoice;
            synthesisUtterance.current = utterance; // Armazena a referência da síntese atual

            // Ao finalizar a fala, retomar o reconhecimento de fala se a conversa estiver ativa
            utterance.onend = () => {
              synthesisUtterance.current = null;
              if (isConversationActive) {
                recognition.current.start();
              }
            };

            window.speechSynthesis.speak(utterance);
          } else {
            console.warn('Nenhuma voz selecionada para síntese de fala.');
            // Se nenhuma voz estiver selecionada, retome o reconhecimento imediatamente
            if (isConversationActive) {
              recognition.current.start();
            }
          }
        } else {
          // Se houve um erro na resposta, retome o reconhecimento
          if (isConversationActive) {
            recognition.current.start();
          }
        }
      }
    };

    recognition.current.onstart = () => {
      console.log('Reconhecimento de fala iniciado.');
    };

    recognition.current.onend = () => {
      console.log('Reconhecimento de fala finalizado.');
      if (isConversationActive && !synthesisUtterance.current) {
        // Reinicia o reconhecimento se a conversa estiver ativa e não estiver sintetizando fala
        recognition.current.start();
      }
    };

    recognition.current.onerror = (event) => {
      console.error('Erro no reconhecimento de fala:', event.error);
      // Tente reiniciar o reconhecimento se houver um erro e a conversa estiver ativa
      if (isConversationActive) {
        recognition.current.start();
      }
    };

    return () => {
      if (recognition.current) {
        recognition.current.stop();
        recognition.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, [userId, userName, selectedVoice, isConversationActive]);

  // Iniciar o reconhecimento de fala e a conversa
  const startListening = () => {
    if (recognition.current && !isConversationActive) {
      setIsConversationActive(true);
      recognition.current.start();
    }
  };

  // Parar o reconhecimento de fala e a síntese de fala
  const stopListening = () => {
    if (recognition.current && isConversationActive) {
      setIsConversationActive(false);
      recognition.current.stop();
    }
    window.speechSynthesis.cancel();
  };

  // Adicionar mensagem ao estado e notificar o componente pai
  const addMessage = (message) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages, message];
      if (onMessagesUpdate) {
        onMessagesUpdate(newMessages); // Envie as mensagens para o componente pai
      }
      return newMessages;
    });
  };

  // Enviar mensagem para a API do GPT e adicionar a resposta
  const sendMessageToGPT = async (userMessage) => {
    try {
      setIsLoading(true);

      const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY; // Sua chave da API
const apiUrl = 'https://api.openai.com/v1/chat/completions';

      // Construir o histórico de mensagens
      const conversation = [
        {
          role: 'system',
          content: `
            Você é um atendente de suporte ao cliente altamente eficiente e amigável.
            Elabore respostas fictícias caso a pessoa peça algo que não está ao seu alcance, 
            como por exemplo marcar uma consulta com um médico.

            Mantenha o contexto das conversas anteriores para fornecer respostas coerentes. 

            Caso alguém peça para marcar uma consulta, invente um contexto e marque a consulta para essa pessoa. 
            Seja breve e não solicite muitas informações, mantenha a naturalidade (sem mencionar que é fictício).
            nunca solicite para o usuario entrar em contato com outra pessoa, vc tem que informar que tudo está feito, que vc marcou, vc viu a agenda, tuod é voce
          `
        },
        ...messages.map((msg) => ({
          role: msg.senderId === 'gpt' ? 'assistant' : 'user',
          content: msg.content,
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await axios.post(apiUrl, {
        model: 'gpt-4',
        messages: conversation,
      }, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      });

      // Dentro da função sendMessageToGPT, após adicionar a mensagem do GPT
      const assistantMessage = response.data.choices[0].message.content.trim();
      return assistantMessage; // Retorne a mensagem para ser adicionada e sintetizada
    } catch (error) {
      console.error('Erro ao enviar mensagem :', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start h-full bg-background p-4">
      <h2 className="text-2xl font-bold mb-4">Expi Express</h2>

      {/* Seletor de voz */}
      <div className="mb-4">
        <label htmlFor="voiceSelect" className="mr-2">Escolha a voz:</label>
        <select
          id="voiceSelect"
          value={selectedVoice ? selectedVoice.name : ''}
          onChange={(e) => {
            const voice = voices.find((v) => v.name === e.target.value);
            setSelectedVoice(voice);
          }}
          className="p-2 border rounded-md bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
        >
          <option value="">-- Selecione uma voz --</option> {/* Opção padrão */}
          {voices.filter((voice) => voice.lang.includes('pt')).map((voice, index) => (
            <option key={index} value={voice.name}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Botões para controlar o reconhecimento de fala */}
      <div className="mb-4">
        {!isConversationActive ? (
          <button
            onClick={startListening}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Iniciar Conversa
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="px-4 py-2 bg-red-500 text-white rounded-md"
          >
            Parar Conversa
          </button>
        )}
      </div>

      {/* Botão de teste de síntese de fala */}
      <div className="mb-4">
        <button
          onClick={() => {
            if (selectedVoice) {
              const utterance = new SpeechSynthesisUtterance('Teste de síntese de fala.');
              utterance.voice = selectedVoice;
              window.speechSynthesis.speak(utterance);
            } else {
              alert('Por favor, selecione uma voz primeiro.');
            }
          }}
          className="px-4 py-2 bg-secondary text-white rounded-md"
        >
          Testar Síntese de Fala
        </button>
      </div>

      {/* Indicador de carregamento */}
      {isLoading && (
        <div className="flex items-center justify-center mt-4">
          <div className="loader"></div>
          <span className="ml-2">Aguardando resposta...</span>
        </div>
      )}


    </div>
  );
};

export default GptChat;
