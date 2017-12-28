module.exports = (io, ioRoom) => {
    const broadcast = (event, payload) => {
        io.to(ioRoom).emit(event, payload);
    };
    
    const broadcast_secret = (event, cb) => {
        io.of('/').in(ioRoom).clients((err, clients) => {
            if(err) {
                throw err;
            }
    
            clients.forEach(s_id => {
                const socket = io.sockets.connected[s_id];
                socket.emit(event, cb(socket));
            });
        });
    };

    const find_socket = id => new Promise((resolve, reject) => {
        io.of('/').in(ioRoom).clients((err, clients) => {
            if(err) {
                return reject(err);
            }

            const s_id = clients.find(s => s.id == id);
            if(!s_id) {
                return reject();
            }
            const socket = io.sockets.connected[s_id];
            resolve(socket);
        });
    });

    return { broadcast, broadcast_secret };
};
