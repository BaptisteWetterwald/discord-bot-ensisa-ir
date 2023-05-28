module.exports = {
    getColor: getColor
};

function checkColor(color){
    return color.match(/^#[0-9A-F]{6}$/i) !== null;
}

function getColor(){
    let color = '#'+Math.floor(Math.random()*16777215).toString(16);
    if (checkColor(color)) return color;
    else return getColor();
}