//Déclaration des modules
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
const cool = require('cool-ascii-faces');



//Déclaration des fichiers statiques
app.use(express.static("./public"));
app.set('view engine', 'ejs')
app.get('/cool', (req, res) => res.send(cool()))

const mongoose = require("mongoose");
//Paramétrage de mongoose (https://mongoosejs.com/docs/4.x/)
mongoose.connect("mongodb+srv://rija:Boubou91!@cluster0.hubrv.mongodb.net/racer?retryWrites=true&w=majority", {useNewUrlParser: true , useUnifiedTopology: true });
//mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true , useUnifiedTopology: true });
//mongoose.connect("mongodb://localhost/racer", {useMongoClient: true});
mongoose.Promise = global.Promise;

// Création de Schéma pour les joueurs
const Player = mongoose.model('Player', new mongoose.Schema({ sonic: String,
  time: { type: Number, default: 0 },
  score: { type: Number, default: 0 }, }));

//Connection à la base de données
const db = mongoose.connection;
db.on("error", console.error.bind(console, "La connexion a échoué: "));
db.once("open", function () {
  console.log("On est bien connecté a la base");
});

//Déclaration des Routes et renvoie de notre fichier source "index.html"
app.get("/", function (req, res) {
  res.sendFile(__dirname + "/index.html");
});

//création du room pour les joueurs
const sonicBox = {
  box: [],
  add: function (sonic) {
    this.box.push(sonic);
  },
  remove: function (sonic) {
    var index = this.box.indexOf(sonic);
    if (index > -1) this.box.splice(index, 1);
  },
  competitor: function (sonic) {
    return this.box.filter(function (element) {
      return element != sonic;
    })[0];
  },
};

var defaultSpeed = 10;
var defaultTrackLength = 200;
var hasWinner = false;
var timeWinner = 0;

//connexion d'un utilisateur
io.sockets.on("connection", function (socket) {
  console.log("Un client est connecté !");
  var playerPositionInTrack = 0;
  var dateStart = 0;
  var dateEnd = 0;

  //Si un utilisateur se connect en trop 'length>1'
  socket.on("newPseudo", function (sonic) {
    console.log(sonicBox.box);
    if (sonicBox.box.length > 1) {
      socket.emit("track", {
        code: 503,
        message: `<div class="text-center"><h3>La room est plein, merci de revenir plus tard et de rafraichir la page</h3></div>`,
      });
      socket.disconnect();
      console.log("client deconnecter");
      return;
    }
    sonic = sonic.trim();
    //sonic vide
    if (sonic == 0) {
      console.log("chaine vide");
      socket.emit("newPseudo", {
        code: 401,
        message: '<p class="alert alert-danger"> pseudo vide</p>',
      });
      return;
    }

    //Si pseudo déjà utiliser
    Player.count({ sonic: sonic }, function (err, count) {
      if (err) return handleError(err);

      if (count > 0) {
        socket.emit("newPseudo", {
          code: 451,
          message: '<p class="alert alert-danger"> pseudo déjà pris</p>',
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
        var player = new Player({ sonic: sonic });
        player.save(function (err) {
          if (err) return handleError(err);
          socket.emit("newPseudo", { code: 200, message: "nouveau sonic" });
          sonicBox.add(player.sonic);
          //Joueur2
          if (sonicBox.box.length === 1) {
            socket.emit("track", {
              code: 404,
              message: `<div class="text-center"><h5>En attente d un autre joueurs</h5></div>`,
              sonic1: player.sonic,
            });
          }
          if (sonicBox.box.length === 2) {
            socket.emit("track", {
              code: 200,
              message:
                '<div class="text-center"><h5>La partie peut commencer quand vous voulez, appuyer sur la barre espace pour faire avancer votre Sonic</h5></div>',
              sonic1: player.sonic,
              sonic2: sonicBox.competitor(player.sonic),
            });

            //update joueur1
            socket.broadcast.emit("track", {
              code: 202,
              message:
                '<div class="text-center"><h5>La partie peut commencer quand vous voulez, appuyer sur la barre espace pour faire avancer votre Sonic</h5></div>',
              sonic2: player.sonic,
            });

            //Compte à rebour avant lancement du jeu
            var compte = 3;
            console.log(compte);
            io.emit(
              "timer",
              `<div class="text-center"><h2>${compte}</h2></div>`
            );

            var id = setInterval(
              function (socket) {
                compte--;
                console.log(compte);
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
                `fin de la game en: ${dateEnd} pour ${player.sonic}`
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
            sonicBox.remove(player.sonic);
          });
        });
      }
    });
  });
});

const port = process.env.PORT || "3000";
server.listen(port, () => console.log(`Écoute sur le port ${port}`));
