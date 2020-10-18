  // Partie socket
var socket = io.connect("http://localhost:3000");

  // Paramétrage de la touche 'Espace'
var spaceKey = true;

function step(spaceKey) {
  window.addEventListener("keydown", function (e) {
    if (spaceKey && e.which == 32) {
      console.log(e.which);
      socket.emit("trackMove", "+1");
      spaceKey = false;
    }
  });
  window.addEventListener("keyup", function (e) {
    if (!spaceKey && e.which == 32) {
      spaceKey = true;
    }
  });
}

window.addEventListener("load", function () {
  var form = document.getElementsByTagName("form")[0];
  var formMessage = document.getElementById("formMessage");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formMessage.innerText = "";
    var inputSonic = document.getElementById("sonic").value;
    socket.emit("newPseudo", inputSonic);
  });

  // Saisie du pseudo
  socket.on("newPseudo", function (message) {
    switch (message.code) {
      case 401:
        formMessage.innerHTML = message.message;
        console.log(message.message);
        break;
      case 451:
        formMessage.innerHTML = message.message;
        console.log(message.message);
        break;
      case 200:
        form.style.display = "none";
        document.getElementById("table").style.visibility = "visible";
        console.log(message.message);
        break;
    }
  });
  // Affichage des joueurs
  socket.on("track", function (message) {
    switch (message.code) {
      case 503:
        document.getElementById("trackInfo").innerHTML = message.message;
        break;
      case 404:
        document.getElementById("trackInfo").innerHTML = message.message;
        document.getElementsByClassName("row-player1")[0].style.visibility =
          "visible";
        document.getElementsByClassName("playerSonic1")[0].textContent =
          message.sonic1;
        break;
      case 200:
        document.getElementById("trackInfo").innerHTML = message.message;
        document.getElementsByClassName("row-player1")[0].style.visibility =
          "visible";
        document.getElementsByClassName("row-player2")[0].style.visibility =
          "visible";
        document.getElementsByClassName("playerSonic1")[0].textContent =
          message.sonic1;
        document.getElementsByClassName("playerSonic2")[0].textContent =
          message.sonic2;
        break;
      case 202:
        document.getElementById("trackInfo").innerHTML = message.message;
        document.getElementsByClassName("row-player2")[0].style.visibility =
          "visible";
        document.getElementsByClassName("playerSonic2")[0].textContent =
          message.sonic2;
        break;
    }
  });
  // Déplacement des avatars
  socket.on("trackMove", function (message) {
    if (message.px1) {
      var witdhDiv = document.getElementsByClassName("row-player1")[0]
        .clientWidth;
      var newPx = message.px1 * witdhDiv;
      document.getElementsByClassName("trackMove1")[0].style.marginLeft =
        newPx + "px";
    }

    if (message.px2) {
      var witdhDiv = document.getElementsByClassName("row-player1")[0]
        .clientWidth;
      var newPx = message.px2 * witdhDiv;
      document.getElementsByClassName("trackMove2")[0].style.marginLeft =
        newPx + "px";
    }
  });
  // Affichage des scores
  socket.on("scoreboard", function (players) {
    document.getElementById("scoreboard").innerHTML = "";

    var render = `<thead>
                            <tr>
                                <th>Pseudo</th>
                                <th>Score</th>
                                <th>Durée</th>
                            </tr>
                           </thead>`;

    render += "<tbody>";

    players.forEach(function (player) {
      var template = `<tr>
                                <td>${player.sonic}</td>
                                <td>${player.score}</td>
                                 <td>${player.time / 1000} s</td>
                              </tr>`;

      render += template;
    });
    render += "</tbody>";
    document.getElementById("scoreboard").innerHTML = render;
  });

  socket.on("information", function (message) {
    document.getElementById("information").innerHTML = message;
  });

  socket.on("timer", function (message) {
    console.log(message);
    document.getElementById("trackInfo").innerHTML = message;
  });

  socket.on("runForest", function (message) {
    step(spaceKey);
  });

  // Chargement des images loose et win
  socket.on("img", function (message) {
    document.getElementById(message.player).src = message.img + "-007.gif";
  });
});
 
  //Recommencer une partie
function restart() {
  location.reload();
}
