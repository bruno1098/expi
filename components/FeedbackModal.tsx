// components/FeedbackModal.tsx
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleColor: string;
  feedbackAnalysis: string | null;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, title, titleColor, feedbackAnalysis }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Fundo escuro que cobre toda a tela */}
      <div className="fixed inset-0 bg-black opacity-75 z-50">

      {/* Conteúdo do Modal */}
      <div className="fixed inset-0 z-60 flex items-center justify-center">
        <div className="white max-w-lg w-full p-6 rounded-lg shadow-lg">
          <DialogHeader>
            <DialogTitle className={titleColor}>{title}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 p-4 border rounded-lg bg-muted">
            <p>{feedbackAnalysis}</p>
          </div>
          <DialogFooter>
            <Button onClick={onClose} className="mt-4">
              Fechar
            </Button>
          </DialogFooter>
        </div>
      </div>
      </div>
    </Dialog>
  );
};

export default FeedbackModal;
