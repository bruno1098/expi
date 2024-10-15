import sgMail from '@sendgrid/mail';

// Defina a chave de API diretamente no código
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export const sendEmail = async (to, subject, text, html) => {
  const msg = {
    to, // E-mail do usuário
    from: 'bruno.saantunes1@gmail.com', // Seu e-mail registrado no SendGrid
    subject, // Assunto do e-mail
    text,    // Corpo do e-mail em texto simples
    html,    // Corpo do e-mail em formato HTML
  };

  try {
    await sgMail.send(msg); // Envia o e-mail usando o SendGrid
    console.log('E-mail enviado com sucesso');
  } catch (error) {
    console.error('Erro ao enviar o e-mail', error.response?.body || error.message);
  }
};
