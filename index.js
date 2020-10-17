//Déclaration des modules
var express = require("express");
var app = express();
var server = require("http").createServer(app);
var io = require("socket.io")(server);
var mongoose = require("mongoose");

//Paramétrage de mongodb
mongoose.connect("mongodb://localhost/runner", { useMongoClient: true });


//Déclaration des fichiers statiques
app.use(express.static("./public"));

//Déclaration de joueur
var playerSchema = mongoose.Schema({
  avatar: String,
  time: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
});
var Player = mongoose.model("Player", playerSchema);

//Connection à la base de données
var db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("On est bien connecté a la base");
});

//Déclaration des Routes et renvoie de notre fichier source "index.html"
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

//création du room pour les joueurs
var avatarBox = {
  box: [],
  add: function (avatar) {
    this.box.push(avatar);
  },
  remove: function (avatar) {
    var index = this.box.indexOf(avatar);
    if (index > -1) this.box.splice(index, 1);
  },
  competitor: function (avatar) {
    return this.box.filter(function (element) {
      return element != avatar;
    })[0];
  },
};

var defaultSpeed = 10;
var defaultTrackLength = 100;
var hasWinner = false;
var timeWinner = 0;

//connexion d'un utilisateur
io.sockets.on("connection", function (socket) {
  console.log("Un client est connecté !");
  var playerPositionInTrack = 0;
  var dateStart = 0;
  var dateEnd = 0;

  //Si un utilisateur se connect en trop 'length>1'
  socket.on("newPseudo", function (avatar) {
    console.log(avatarBox.box);
    if (avatarBox.box.length > 1) {
      socket.emit("track", {
        code: 503,
        message: `<div class="text-center"><h3>La room est plein, merci de revenir plus tard et de rafraichir la page</h3></div>`,
      });
      socket.disconnect();
      console.log("client deconnecter");
      return;
    }
    avatar = avatar.trim();
    //avatar vide
    if (avatar == 0) {
      console.log("chaine vide");
      socket.emit("newPseudo", {
        code: 401,
        message: '<p class="alert alert-danger"> pseudo vide</p>',
      });
      return;
    }

    //Si pseudo déjà utiliser
    Player.count({ avatar: avatar }, function (err, count) {
      if (err) return handleError(err);

      if (count > 0) {
        socket.emit("newPseudo", {
          code: 451,
          message: '<p class="alert alert-danger"> pseudo deja pris</p>',
        });
      } else {
        //Sinon lancer le jeux
        Player.find({})
          .sort({ _id: -1 })
          .exec(function (err, player) {
            if (err) return console.error(err);
            console.log(player);
            io.emit("scoreboard", player);
          });

        //Déclaration du joueur1
        var player = new Player({ avatar: avatar });
        player.save(function (err) {
          if (err) return handleError(err);
          socket.emit("newPseudo", { code: 200, message: "nouveau avatar" });
          avatarBox.add(player.avatar);
          //Joueur2
          if (avatarBox.box.length === 1) {
            socket.emit("track", {
              code: 404,
              message: `<div class="text-center"><h5>En attente d un autre joueurs</h5></div>`,
              avatar1: player.avatar,
            });
          }
          if (avatarBox.box.length === 2) {
            socket.emit("track", {
              code: 200,
              message:
                '<div class="text-center"><h5>La partie peut commencer quand vous voulez, appuyer sur la barre espace pour faire avancer votre avatar</h5></div>',
              avatar1: player.avatar,
              avatar2: avatarBox.competitor(player.avatar),
            });

            //update joueur1
            socket.broadcast.emit("track", {
              code: 202,
              message:
                '<div class="text-center"><h5>La partie peut commencer quand vous voulez, appuyer sur la barre espace pour faire avancer votre avatar</h5></div>',
              avatar2: player.avatar,
            });

            //Compte à rebour avant lancement du jeu
            var compte = 3;
            console.log("Tictac! " + compte);
            io.emit(
              "timer",
              `<div class="text-center"><h2>${compte}</h2></div>`
            );

            var id = setInterval(
              function (socket) {
                compte--;
                console.log("titac " + compte);
                io.emit(
                  "timer",
                  `<div class="text-center"><h2>${compte}</h2></div>`
                );
                if (compte == 0) {
                  io.emit(
                    "timer",
                    `<div class="text-center"><h2>RUN</h2></div>`
                  );
                  io.emit("runForest", "run");
                  clearInterval(id);
                }
              },
              1000,
              socket
            );
          }

          // prendre les déplacements des joueurs 
          socket.on("trackMove", function (message) {
            playerPositionInTrack += defaultSpeed;
            var trMoov = playerPositionInTrack / defaultTrackLength;
            if (trMoov <= 1) socket.emit("trackMove", { px1: trMoov });
            if (trMoov <= 1) socket.broadcast.emit("trackMove", { px2: trMoov });

          // Prendre le temps des joueurs par rapport à leur position
            if (dateStart == 0) dateStart = new Date();
            if (trMoov >= 1 && dateEnd == 0) {
              dateEnd = new Date() - dateStart;
              console.log(
                `fin de la game en: ${dateEnd} pour ${player.avatar}`
              );

          // Affichage de l'image win au winner
              if (!hasWinner) {
                socket.emit("img", { player: "player1", img: "win" });
                socket.broadcast.emit("img", { player: "player2", img: "win" });

          // Alert succes en cas de victoire + score
                timeWinner = dateEnd;
                hasWinner = true;
                player.score += 1;
                var message = `<div class="alert alert-success" role="alert">
                  Tu as gagné en ${dateEnd / 1000} s
                </div>`;
                socket.emit("information", message);
              } else {
                socket.emit("img", { player: "player1", img: "loose" });
                socket.broadcast.emit("img", {
                  player: "player2",
                  img: "loose",
                });
                hasWinner = false;

            // Alerte danger pour le looser + score
                var message = `<div class="alert alert-danger" role="alert">
                  Tu as perdu de ${(dateEnd - timeWinner) / 1000}s
                </div>`;
                socket.emit("information", message);
                timeWinner = 0;
              }
            // Sauvegarde des scores
              player.time += dateEnd;
              player.save(function (err) {
                if (err) return console.error(err);
                console.log("player save run time");
            // Récupération des scores
                Player.find({})
                  .sort({ _id: -1 })
                  .exec(function (err, player) {
                    if (err) return console.error(err);
                    console.log(player);
                    io.emit("scoreboard", player);
                  });
              });
            }
          });
          
            // Déconnexion d'un joueur
          socket.on("disconnect", function () {
            avatarBox.remove(player.avatar);
          });
        });
      }
    });
  });
});
server.listen("3000", () => console.log("Écoute sur le port 3000"));
