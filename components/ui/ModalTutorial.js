import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ModalTutorial = ({ isOpen, onClose, content, onNext, onPrev, step, totalSteps, highlightStyle }) => {
  if (!isOpen) return null;

  // Condicional para mudar a posição do modal no passo desejado (por exemplo, passo 2)
  const isBottomStep = step === 4; // Ajuste o número do passo conforme necessário

  // Se for o passo que queremos colocar o modal na parte de baixo, ajustamos a posição
  const modalPosition = isBottomStep
    ? {
        top: '150px', // Na parte de baixo da tela
        left: '40%',
        transform: 'translateX(-50%)', // Centraliza horizontalmente
      }
    : {
        top: `${Math.max(highlightStyle.top - 220, 10)}px`, // Posição normal para os outros passos
        left: `${Math.min(Math.max(highlightStyle.left - 140, 10), window.innerWidth - 320)}px`,
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="modal-tutorial"
        style={{
          position: 'absolute',
          
          ...modalPosition, // Usa a posição baseada na condicional
          width: '300px',
          padding: '20px',
          backgroundColor: '#1a1a2e', // Fundo claro e moderno
          border: '1px solid #e0e0e0',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)', // Sombra suave
          zIndex: 10001,
          borderRadius: '12px',
          overflow: 'hidden', // Garante que o conteúdo não seja cortado
          fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', // Tipografia moderna
          color: '#999',
        }}
      >
        {/* Botão de Fechar (X) */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            color: '#999',
          }}
        >
          &times;
        </button>

        <div style={{ marginBottom: '10px', fontSize: '16px', color: '#ffffff' }}>
          <p>{content}</p>
        </div>

        {/* Indicador de progresso */}
        <div style={{
          height: '6px',
          width: '100%',
          backgroundColor: '#e0e0e0',
          borderRadius: '3px',
          margin: '10px 0',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '6px',
            width: `${((step + 1) / totalSteps) * 100}%`,
            backgroundColor: '#7b2cbf',
            borderRadius: '3px',
            transition: 'width 0.4s',
          }}></div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '10px'
        }}>
          {step > 0 && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPrev} 
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'background-color 0.3s',
              }}>
              Voltar
            </motion.button>
          )}
          {step < totalSteps - 1 ? (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onNext} 
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'background-color 0.3s',
              }}>
              Próximo
            </motion.button>
          ) : (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose} 
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '10px 15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'background-color 0.3s',
              }}>
              Fechar
            </motion.button>
          )}
        </div>

        {/* Seta apontando para o destaque */}
        <style jsx>{`
          .modal-tutorial::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -10px;
            border-width: 10px;
            border-style: solid;
            border-color: #f9f9f9 transparent transparent transparent;
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
};

export default ModalTutorial;
