import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'; // Ajuste o caminho conforme necessário

const GptChat = ({ userName, userId, onMessagesUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [shouldRestartRecognition, setShouldRestartRecognition] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const recognition = useRef(null);

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

        // Envia a mensagem para a API da OpenAI
        const response = await sendMessageToGPT(transcript);

        if (response) {
          // Adiciona a resposta do GPT à lista de mensagens
          addMessage({ senderId: 'gpt', senderName: 'GPT', content: response });

          // Adicionar síntese de fala para a resposta do GPT
          if (selectedVoice) {
            console.log('Usando a voz selecionada:', selectedVoice.name); // Log para depuração
            const utterance = new SpeechSynthesisUtterance(response);
            utterance.voice = selectedVoice;
            window.speechSynthesis.speak(utterance);
          } else {
            console.warn('Nenhuma voz selecionada para síntese de fala.');
          }
        }
      }
    };

    recognition.current.onstart = () => {
      setIsListening(true);
    };

    recognition.current.onend = () => {
      setIsListening(false);

      if (shouldRestartRecognition) {
        recognition.current.start();
        setShouldRestartRecognition(false);
      }
    };

    recognition.current.onerror = (event) => {
      console.error('Erro no reconhecimento de fala:', event.error);
    };

    return () => {
      if (recognition.current) {
        recognition.current.stop();
        recognition.current = null;
      }
    };
  }, [userId, userName, shouldRestartRecognition, selectedVoice]);

  // Iniciar o reconhecimento de fala
  const startListening = () => {
    if (recognition.current && !isListening) {
      recognition.current.start();
    }
  };

  // Parar o reconhecimento de fala
  const stopListening = () => {
    if (recognition.current && isListening) {
      recognition.current.stop();
    }
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
      console.error('Erro ao enviar mensagem para o :', error);
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
        {!isListening ? (
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
