const Discord = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

module.exports = {
    setClockAvatar,
};

async function setClockAvatar(client){
    let canvas = createCanvas(128, 128);
    let ctx = canvas.getContext('2d');

    let avatar = await loadImage('./images/mehmett.jpg');

    // make the avatar a circle
    ctx.beginPath();
    ctx.arc(64, 64, 64, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(avatar, 0, 0, 128, 128);

    // draw a small circle in the middle
    ctx.beginPath();
    ctx.arc(64, 64, 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fillStyle = '#000000';
    ctx.fill();

    // draw numbers around the circle
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
        let angle = (i - 3) * (Math.PI * 2) / 12;
        let x = 64 + Math.cos(angle) * 48;
        let y = 64 + Math.sin(angle) * 48;
        ctx.fillText(i.toString(), x, y);
    }

    // draw the clock hands (hours and minutes) based on the current time (in the 'Europe/Paris' timezone)
    let now = new Date();
    let frenchTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    let hour = frenchTime.getHours();
    let minute = frenchTime.getMinutes();

    // draw the hour hand
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.lineTo(64 + Math.cos(((hour - 3) + minute / 60) * (Math.PI * 2) / 12) * 32, 64 + Math.sin(((hour - 3) + minute / 60) * (Math.PI * 2) / 12) * 32);
    ctx.closePath();
    ctx.stroke();

    client.user.setAvatar(canvas.toBuffer()).catch(console.error);
}