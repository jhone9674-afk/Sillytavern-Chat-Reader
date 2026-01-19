(function () {
    console.log("[Chat Reader] Extension Loaded");

    const CSS = `
    .chat-reader-container {
        display: flex;
        flex-direction: column;
        gap: 15px;
        max-height: 85vh;
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        background: #111;
        border-radius: 8px;
        color: #e0e0e0;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    .chat-reader-msg {
        display: flex;
        flex-direction: column;
        padding: 8px 12px;
        border-radius: 6px;
        background: #222;
        border-left: 4px solid #444;
    }
    .chat-reader-msg.user {
        border-left-color: #81c784;
    }
    .chat-reader-msg.char {
        border-left-color: #64b5f6;
    }
    .chat-reader-name {
        font-weight: bold;
        font-size: 0.9em;
        margin-bottom: 4px;
        color: #9be7ff;
    }
    .chat-reader-msg.user .chat-reader-name {
        color: #81c784;
    }
    .chat-reader-text {
        white-space: pre-wrap;
        line-height: 1.4;
    }
    .chat-reader-date {
        font-size: 0.75em;
        color: #888;
        margin-top: 5px;
        align-self: flex-end;
    }
    `;

    function injectCSS() {
        if ($('#chat-reader-css').length === 0) {
            $('<style id="chat-reader-css">').text(CSS).appendTo('head');
        }
    }

    function injectButton() {
        // 1. Inject into the template in index.html
        const template = $('#past_chat_template .flex-container.gap10px').last();
        if (template.length && template.find('.chatReaderButton').length === 0) {
            const btn = $('<div title="Chat Reader" class="chatReaderButton opacity50p hoverglow fa-solid fa-book" data-i18n="[title]Chat Reader" style="cursor: pointer;"></div>');
            template.find('.PastChat_cross').before(btn);
        }

        // 2. Inject into already rendered items in the list (Manage Chat Files popup)
        $('#select_chat_div .flex-container.gap10px').each(function () {
            if ($(this).find('.chatReaderButton').length === 0) {
                const btn = $('<div title="Chat Reader" class="chatReaderButton opacity50p hoverglow fa-solid fa-book" data-i18n="[title]Chat Reader" style="cursor: pointer;"></div>');
                $(this).find('.PastChat_cross').before(btn);
            }
        });
    }

    async function openReader(filename) {
        try {
            const context = window.SillyTavern.getContext();
            const charId = context.characterId;
            const characters = context.characters;

            if (charId === undefined || !characters[charId]) {
                toastr.error("No character selected or found.");
                return;
            }

            const avatar = characters[charId].avatar;
            const body = {
                avatar_url: avatar,
                file_name: filename.replace('.jsonl', ''),
            };

            const response = await fetch('/api/chats/get', {
                method: 'POST',
                headers: context.getRequestHeaders(),
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error("Failed to fetch chat content");

            const chatData = await response.json();
            if (!Array.isArray(chatData)) throw new Error("Invalid chat data format");

            renderChatPopup(filename, chatData);
        } catch (error) {
            console.error("[Chat Reader] Error:", error);
            toastr.error("Could not load chat for reading.");
        }
    }

    function renderChatPopup(title, chatData) {
        const container = $('<div class="chat-reader-container"></div>');

        // Skip metadata at index 0
        chatData.slice(1).forEach(item => {
            if (!item.mes) return;

            const msgClass = item.is_user ? 'user' : 'char';
            const msgDiv = $(`<div class="chat-reader-msg ${msgClass}"></div>`);

            const nameDiv = $(`<div class="chat-reader-name"></div>`).text(item.name || (item.is_user ? "User" : "Character"));
            const textDiv = $(`<div class="chat-reader-text"></div>`).text(item.mes);

            msgDiv.append(nameDiv).append(textDiv);

            if (item.send_date) {
                const dateDiv = $(`<div class="chat-reader-date"></div>`).text(new Date(item.send_date).toLocaleString());
                msgDiv.append(dateDiv);
            }

            container.append(msgDiv);
        });

        if (container.children().length === 0) {
            container.append('<div style="text-align:center; opacity:0.5;">[Chat is empty]</div>');
        }

        // Use ST's global popup function
        const context = window.SillyTavern.getContext();
        context.callGenericPopup(container, context.POPUP_TYPE.TEXT, "", { wide: true, large: true, okButton: "Close", cancelButton: false });
    }

    $(document).on('click', '.chatReaderButton', function (e) {
        e.stopPropagation();
        const filename = $(this).closest('.select_chat_block_wrapper').find('.select_chat_block_filename').text();
        openReader(filename);
    });

    function init() {
        if (window.SillyTavern && window.SillyTavern.getContext) {
            injectCSS();
            injectButton();
            setInterval(injectButton, 1000);
        } else {
            setTimeout(init, 100);
        }
    }

    $(document).ready(init);
})();
