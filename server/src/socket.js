import jwt from "jsonwebtoken";
import config from "./config.js";
import User from "./models/User.js";
import Match from "./models/Match.js";
import Message from "./models/Message.js";

export function setupSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("User not found"));
      socket.user = user;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user._id.toString();
    socket.join(userId);

    socket.on("send_message", async (data) => {
      try {
        const { matchId, text } = data;
        if (!text?.trim()) return;

        const match = await Match.findOne({
          _id: matchId,
          users: socket.user._id,
        });
        if (!match) return;

        const message = await Message.create({
          match: match._id,
          sender: socket.user._id,
          text: text.trim(),
        });

        match.lastMessage = message._id;
        match.lastActivity = new Date();
        await match.save();

        const recipientId = match.users.find(
          (u) => u.toString() !== userId
        );

        const payload = {
          matchId: match._id,
          message: {
            ...message.toObject(),
            sender: socket.user.toProfile(),
          },
        };

        io.to(recipientId.toString()).emit("message", payload);
        socket.emit("message_sent", payload);
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("typing", (data) => {
      const { matchId } = data;
      socket.broadcast.to(matchId).emit("typing", { matchId, userId });
    });

    socket.on("read_messages", async (data) => {
      try {
        const { matchId } = data;
        await Message.updateMany(
          { match: matchId, sender: { $ne: socket.user._id }, read: false },
          { read: true }
        );
        const match = await Match.findById(matchId);
        if (match) {
          const recipientId = match.users.find(
            (u) => u.toString() !== userId
          );
          io.to(recipientId.toString()).emit("messages_read", { matchId });
        }
      } catch (err) {
        socket.emit("error", { message: err.message });
      }
    });

    socket.on("disconnect", () => {
      socket.leave(userId);
    });
  });
}
