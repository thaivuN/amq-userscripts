// ==UserScript==
// @name         AMQ Co-op Autopaste
// @namespace    https://github.com/ayyu/
// @version      1.1
// @description  Automatically pastes your submitted answer to chat. Piggybacks off TheJoseph98's framework.
// @author       ayyu
// @match        https://animemusicquiz.com/*
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @updateURL    https://raw.githubusercontent.com/ayyu/amq-scripts/master/amqCoopPaste.js
// ==/UserScript==

if (!window.setupDocumentDone) return;

function setup() {
	// create paster window
    coopWindow = new AMQWindow({
        title: "Co-op Autopaste",
        width: 300,
        height: 130,
        zIndex: 1054,
        draggable: true
    });
    coopWindow.addPanel({
        width: 1.0,
        height: 50,
        id: "coopWindowControls"
    });
	coopWindow.panels[0].panel.append($(`<div></div>`)
        .addClass("customCheckboxContainer")
        .append($(`<div></div>`)
        	.addClass("customCheckbox")
	        .append($(`<input id="coopPasteCheckbox" type="checkbox">`))
	        .append($("<label for='coopPasteCheckbox'><i class='fa fa-check' aria-hidden='true'></i></label>"))
        )
        .append($(`<label for="coopPasteCheckbox"></label>`)
        	.addClass("customCheckboxContainerLabel")
        	.text("Enable auto-paste"))
    );

	// Adds button to in-game options to enable paster
    let oldWidth = $("#qpOptionContainer").width();
    $("#qpOptionContainer").width(oldWidth + 35);
    $("#qpOptionContainer > div").append($(`<div id="qpCoopPaster" class="clickAble qpOption"><i aria-hidden="true" class="fa fa-paste qpMenuItem"></i></div>`)
        .click(() => {
            if (coopWindow.isVisible()) {
                coopWindow.close();
            }
            else {
                coopWindow.open();
            }
        })
        .popover({
            content: "Co-op Autopaster",
            trigger: "hover",
            placement: "bottom"
        })
    );

    // add Enter key listener for copypasta
	let quizReadyListener = new Listener("quiz ready", data => {
		if (quiz.gameMode !== "Ranked") {
			$("#qpAnswerInput").off("keypress", answerHandler);
			$("#qpAnswerInput").on("keypress", answerHandler);
		}
		else {
			$("#qpAnswerInput").off("keypress", answerHandler);
		}
	});

	// Sends current answer as chat message
	let answerHandler = function (event) {
		if (event.which === 13 && $("#coopPasteCheckbox").prop("checked")) {
			gameChat.$chatInputField.val($("#qpAnswerInput").val());
			gameChat.sendMessage();
		}
	}

	quizReadyListener.bindListener();

    console.log("co-op setup");
}

setup();

AMQ_addScriptData({
	name: "Co-op Autopaste",
	author: "ayyu",
	description: `
		<p>Automatically pastes your submitted answer to chat, for grinding co-op lobbies. This script is disabled during ranked.</p>
        <p>The script can be turned on by clicking on the clipboard icon in the top right next to the settings icon while in a quiz.</p>
        <p>Piggybacks off of some parts by TheJoseph98</p>
	`
});

AMQ_addStyle(`
	#qpCoopPaster {
        width: 30px;
        margin-right: 5px;
    }
    #coopWindowControls .customCheckboxContainer {
    	padding: 1rem 0;
		align-items: center;
	  	justify-content: center;
    }
    .customCheckboxContainer {
        display: flex;
    }
    .customCheckboxContainer > div {
        display: inline-block;
        margin: 5px 0px;
    }
    .customCheckboxContainer > .customCheckboxContainerLabel {
        margin-left: 5px;
        margin-top: 5px;
        font-weight: normal;
    }
`);