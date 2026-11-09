let handler = async (m, { conn, text, usedPrefix, command }) => {
    const excusas = [
        "No lo hice porque el cable del internet de mi tostadora estaba desconectado.",
        "La base de datos se cayó porque un gato pisó el teclado.",
        "Eso no es un error, es una característica avanzada que tu mente inferior no comprende.",
        "Pregúntale a Aether Labs, yo solo soy un bot de adorno.",
        "El servidor se mareó con tantas peticiones y prefirió ignorarte.",
        "El procesador sufrió una sobredosis de anime y se puso sentimental.",
        "Intenté arreglarlo, pero me dio flojera y preferí reiniciar el cosmos.",
        "La inteligencia artificial se fue a almorzar menú y dejó encargado al becario.",
        "Ese comando consume demasiados carbohidratos, el sistema se puso a dieta.",
        "Alguien metió un virus en formato .png y la pantalla se mareó.",
        "Los hamsters que corren en la rueda del servidor están de huelga por horas extras."
    ];
    
    // Simula un estado de tipeo para darle más suspenso al chiste
    await conn.sendPresenceUpdate('composing', m.chat);
    
    // Espera 1.5 segundos para dar efecto de "análisis técnico"
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Elige una excusa al azar de la lista ampliada
    const excusaAleatoria = excusas[Math.floor(Math.random() * excusas.length)];
    
    await conn.reply(m.chat, `🤖 *Diagnóstico técnico avanzado:* \n\n${excusaAleatoria}`, m);
}

handler.help = ['mentira']
handler.tags = ['utils']
handler.command = /^(mentira|excusa|bugfalso|excusas)$/i

export default handler
