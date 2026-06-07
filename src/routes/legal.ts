import type { FastifyInstance } from 'fastify';

export async function legalRoutes(app: FastifyInstance) {
  app.get('/privacy', async (_request, reply) => {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Política de Privacidad - Camping Zumaia</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
          h1 { color: #333; }
          h2 { color: #555; margin-top: 2rem; }
        </style>
      </head>
      <body>
        <h1>Política de Privacidad</h1>
        <p><strong>Última actualización:</strong> ${new Date().toISOString().split('T')[0]}</p>
        
        <h2>1. Introducción</h2>
        <p>Esta política de privacidad describe cómo recopilamos, usamos y compartimos tu información personal cuando interactúas con nuestra aplicación de Instagram para la gestión de clientes de Camping Zumaia.</p>
        
        <h2>2. Información que Recopilamos</h2>
        <p>Recopilamos la siguiente información cuando un usuario sigue nuestra cuenta de Instagram:</p>
        <ul>
          <li>ID de usuario de Instagram (identificador anónimo)</li>
          <li>Fecha y hora del seguimiento</li>
          <li>Estado de los códigos de descuento generados</li>
        </ul>
        
        <h2>3. Uso de la Información</h2>
        <p>Utilizamos tu información para:</p>
        <ul>
          <li>Enviar mensajes de bienvenida automatizados</li>
          <li>Generar y gestionar códigos de descuento exclusivos</li>
          <li>Mejorar nuestra comunicación con seguidores</li>
        </ul>
        
        <h2>4. Compartición de Datos</h2>
        <p>No vendemos, comercializamos ni transferimos tu información personal a terceros, excepto para proporcionar nuestros servicios o cumplir con la ley.</p>
        
        <h2>5. Seguridad</h2>
        <p>Implementamos medidas de seguridad adecuadas para proteger tu información contra acceso no autorizado, alteración, divulgación o destrucción.</p>
        
        <h2>6. Tus Derechos</h2>
        <p>Puedes solicitar el acceso, corrección o eliminación de tus datos personales contactándonos.</p>
        
        <h2>7. Contacto</h2>
        <p>Para consultas sobre esta política, contáctanos a través de nuestro perfil de Instagram.</p>
      </body>
      </html>
    `);
  });

  app.get('/service-conditions', async (_request, reply) => {
    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Términos de Servicio - Camping Zumaia</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
          h1 { color: #333; }
          h2 { color: #555; margin-top: 2rem; }
        </style>
      </head>
      <body>
        <h1>Términos de Servicio</h1>
        <p><strong>Última actualización:</strong> ${new Date().toISOString().split('T')[0]}</p>
        
        <h2>1. Aceptación de los Términos</h2>
        <p>Al interactuar con nuestra aplicación de Instagram, aceptas estos términos de servicio en su totalidad.</p>
        
        <h2>2. Descripción del Servicio</h2>
        <p>Ofrecemos un sistema automatizado que envía mensajes de bienvenida y códigos de descuento a nuevos seguidores de nuestra cuenta de Instagram.</p>
        
        <h2>3. Códigos de Descuento</h2>
        <ul>
          <li>Los códigos son de un solo uso y tienen fecha de expiración</li>
          <li>No son transferibles ni canjeables por efectivo</li>
          <li>Se aplican únicamente a compras realizadas en nuestra tienda online</li>
        </ul>
        
        <h2>4. Limitación de Responsabilidad</h2>
        <p>No seremos responsables de daños indirectos, incidentales o consecuentes derivados del uso de nuestros servicios.</p>
        
        <h2>5. Modificaciones</h2>
        <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación.</p>
        
        <h2>6. Contacto</h2>
        <p>Para preguntas sobre estos términos, contáctanos a través de nuestro perfil de Instagram.</p>
      </body>
      </html>
    `);
  });
}
