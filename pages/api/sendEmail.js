import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);




export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { to, subject, text, html } = req.body;

    const msg = {
      to, // E-mail do usuário
      from: 'expi2fiap@gmail.com', // Use o e-mail verificado no SendGrid
      subject, // Assunto do e-mail
      text,    // Corpo do e-mail em texto simples
      html,    // Corpo do e-mail em formato HTML
    };

    try {
      await sgMail.send(msg); // Envia o e-mail usando o SendGrid
      return res.status(200).json({ message: 'E-mail enviado com sucesso' });
    } catch (error) {
      console.error('Erro ao enviar o e-mail', error.response?.body || error.message);
      return res.status(500).json({ error: 'Erro ao enviar o e-mail' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Método ${req.method} não permitido`);
  }
}
