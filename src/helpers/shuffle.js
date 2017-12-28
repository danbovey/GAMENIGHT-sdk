const shuffle = arr => {
    arr = arr.slice();
    
    for(let i = arr.length; i; i--) {
        let j = Math.floor(Math.random() * i);
        [arr[i - 1], arr[j]] = [arr[j], arr[i - 1]];
    }

    return arr;
};

module.exports = shuffle;
