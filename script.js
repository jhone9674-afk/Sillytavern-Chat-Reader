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
    #reader-mode-toggle.isActive {
        color: #64b5f6;
        opacity: 1;
    }
    #extensionTopBarChatName.reader-mode-active {
        border-color: #64b5f6;
        box-shadow: 0 0 4px rgba(100, 181, 246, 0.3);
    }
    `;

    function injectCSS() {
        if ($('#chat-reader-css').length === 0) {
            $('<style id="chat-reader-css">').text(CSS).appendTo('head');
        }
    }

    // ─── Inject the book icon into the Manage Chat Files list ───
    function injectButton() {
        const template = $('#past_chat_template .flex-container.gap10px').last();
        if (template.length && template.find('.chatReaderButton').length === 0) {
            const btn = $('<div title="Chat Reader" class="chatReaderButton opacity50p hoverglow fa-solid fa-book" data-i18n="[title]Chat Reader" style="cursor: pointer;"></div>');
            template.find('.PastChat_cross').before(btn);
        }

        $('#select_chat_div .flex-container.gap10px').each(function () {
            if ($(this).find('.chatReaderButton').length === 0) {
                const btn = $('<div title="Chat Reader" class="chatReaderButton opacity50p hoverglow fa-solid fa-book" data-i18n="[title]Chat Reader" style="cursor: pointer;"></div>');
                $(this).find('.PastChat_cross').before(btn);
            }
        });
    }

    // ─── Reader Mode ───
    let isReaderMode = false;

    // Store available chat options when entering reader mode
    let readerModeChatOptions = [];

    // Show a popup to select a chat for reading (when dropdown is disabled)
    async function showChatSelectionPopup() {
        const mainDropdown = $('#extensionTopBarChatName');
        if (!mainDropdown.length) return;

        // Get all options from the dropdown
        const options = [];
        mainDropdown.find('option').each(function () {
            options.push({
                value: $(this).val(),
                text: $(this).text()
            });
        });

        if (options.length === 0) {
            toastr.warning("No chats available.");
            return;
        }

        // Build a simple list HTML
        let listHtml = '<div class="reader-chat-list" style="max-height: 400px; overflow-y: auto;">';
        options.forEach((opt, idx) => {
            listHtml += `<div class="reader-chat-option" data-value="${opt.value}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #444; transition: background 0.2s;" onmouseover="this.style.background='#555'" onmouseout="this.style.background=''">${opt.text}</div>`;
        });
        listHtml += '</div>';

        const context = window.SillyTavern.getContext();
        const result = await context.callGenericPopup(listHtml, context.POPUP_TYPE.TEXT, '', {
            okButton: false,
            cancelButton: 'Close',
            wide: false,
            rows: 1
        });

        // The popup won't return a value for our custom clicks, we handle clicks directly
    }

    // Setup click handlers for the popup list
    function setupReaderPopupClicks() {
        $(document).off('click.readerChatOption').on('click.readerChatOption', '.reader-chat-option', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const filename = $(this).data('value');
            console.log("[Chat Reader] Selected from popup:", filename);

            // Close the popup
            $('.popup-button-cancel, .popup_close').trigger('click');

            // Open reader
            if (filename) {
                setTimeout(() => openReader(filename), 100);
            }
        });
    }

    function activateReaderMode() {
        isReaderMode = true;

        const readerBtn = $('#reader-mode-toggle');
        const mainDropdown = $('#extensionTopBarChatName');

        readerBtn.addClass('isActive');

        if (mainDropdown.length) {
            // Store the current value
            mainDropdown.data('reader-original-value', mainDropdown.val());
            mainDropdown.addClass('reader-mode-active');

            // DISABLE the dropdown to prevent any native interaction
            mainDropdown.prop('disabled', true);

            // Add a click handler wrapper that will show our custom popup
            // We create an overlay element that captures clicks
            if (!$('#reader-dropdown-overlay').length) {
                const overlay = $('<div id="reader-dropdown-overlay"></div>').css({
                    position: 'absolute',
                    cursor: 'pointer',
                    background: 'transparent',
                    zIndex: 1000
                });

                // Position it over the dropdown
                const updateOverlayPosition = () => {
                    if (!isReaderMode) return;
                    const dd = $('#extensionTopBarChatName');
                    if (dd.length && dd.is(':visible')) {
                        const offset = dd.offset();
                        overlay.css({
                            top: offset.top,
                            left: offset.left,
                            width: dd.outerWidth(),
                            height: dd.outerHeight()
                        }).show();
                    }
                };

                overlay.on('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    showChatSelectionPopup();
                });

                $('body').append(overlay);
                updateOverlayPosition();

                // Update position on window resize/scroll
                $(window).on('resize.readerOverlay scroll.readerOverlay', updateOverlayPosition);
                // Also periodically update in case of dynamic layout changes
                const intervalId = setInterval(() => {
                    if (!isReaderMode) {
                        clearInterval(intervalId);
                        return;
                    }
                    updateOverlayPosition();
                }, 500);
            }
        }

        setupReaderPopupClicks();
        toastr.info("Reader Mode Active. Click the dropdown to select a chat to read.");
    }

    function deactivateReaderMode() {
        isReaderMode = false;

        const readerBtn = $('#reader-mode-toggle');
        const mainDropdown = $('#extensionTopBarChatName');

        readerBtn.removeClass('isActive');
        mainDropdown.removeClass('reader-mode-active');

        // Re-enable the dropdown
        mainDropdown.prop('disabled', false);

        // Remove the overlay
        $('#reader-dropdown-overlay').remove();
        $(window).off('resize.readerOverlay scroll.readerOverlay');
        $(document).off('click.readerChatOption');
    }

    function toggleReaderMode() {
        if (isReaderMode) {
            deactivateReaderMode();
        } else {
            activateReaderMode();
        }
    }

    function injectReaderMode() {

        if ($('#reader-mode-toggle').length > 0) return;

        const mainDropdown = $('#extensionTopBarChatName');
        if (mainDropdown.length === 0) return;

        const btn = $(`
            <div id="reader-mode-toggle"
                 class="menu_button fa-solid fa-book"
                 title="Reader Mode: Click to read chats without switching"
                 style="margin-left: 5px; cursor: pointer; width: 30px; text-align: center;">
            </div>
        `);

        // If we are injecting a fresh button but mode is active (e.g. UI refresh), restore state
        if (isReaderMode) {
            btn.addClass('isActive');
        }

        btn.on('click', toggleReaderMode);
        mainDropdown.after(btn);
    }

    // ─── Core: fetch chat data from the server ───
    async function fetchChatData(filename) {
        const context = window.SillyTavern.getContext();
        const charId = context.characterId;
        // In SillyTavern, the active group is often stored in 'selectedGroup' or 'groupId'
        // We check 'selectedGroup' because that's the standard property for the UI state
        const groupId = context.selectedGroup || context.groupId;
        const characters = context.characters;
        const groups = context.groups;

        console.log("[Chat Reader] Context check:", { charId, groupId, hasCharacters: !!characters, hasGroups: !!groups });

        // Logic update: Handle Groups
        // If we are in a group, charId might be null/undefined or irrelevant
        if (groupId && groups) {
            // We are in a group
            // For group chats, the file is usually associated with the group
        } else if (charId === undefined || !characters[charId]) {
            toastr.error("No character selected.");
            return null;
        }

        let charName = "Unknown";
        let avatar = "";

        if (groupId && groups) {
            const group = groups.find(g => g.id === groupId) || groups[groupId];
            if (group) {
                console.log("[Chat Reader] Found Group:", group.name);
                charName = group.name;
                // Groups don't always have a single avatar URL in the same way, or it's a composite
                // We can leave avatar empty or find a representational one
                // But critically, we don't fail just because charId is missing
            } else {
                console.warn("[Chat Reader] Group ID found but group data missing.");
            }
        } else {
            charName = characters[charId].name;
            avatar = characters[charId].avatar;
        }

        const userName = context.name1 || "User"; // Fallback if name1 is missing

        let processedFilename = filename;
        if (charName) {
            processedFilename = processedFilename.replace(/{{char}}/gi, charName);
        }
        if (userName) {
            processedFilename = processedFilename.replace(/{{user}}/gi, userName);
        }

        let body = {};
        let url = '/api/chats/get';

        if (groupId && groups) {
            // Group Chat: Use specific endpoint and payload
            url = '/api/chats/group/get';
            // The API expects 'id' which is the filename for the group chat
            body = {
                id: processedFilename.replace(/\.jsonl$/, '')
            };
            console.log(`[Chat Reader] Fetching GROUP chat: "${body.id}" from ${url}`);
        } else {
            // Normal Character Chat
            url = '/api/chats/get';
            body = {
                file_name: processedFilename.replace(/\.jsonl$/, ''),
                ch_name: charName,
                avatar_url: avatar,
            };
            console.log(`[Chat Reader] Fetching CHARACTER chat: "${body.file_name}" from ${url}`);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: context.getRequestHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            console.error(`[Chat Reader] Fetch failed: ${response.status} ${response.statusText}`);
            throw new Error(response.statusText);
        }

        const chatData = await response.json();
        console.log(`[Chat Reader] Fetched data type:`, typeof chatData, Array.isArray(chatData));
        if (chatData.length > 0) {
            console.log(`[Chat Reader] First item keys:`, Object.keys(chatData[0]));
            console.log(`[Chat Reader] First item full:`, chatData[0]);
        }
        console.log(`[Chat Reader] Total items:`, chatData.length);

        if (!Array.isArray(chatData)) throw new Error("Invalid chat data format");

        return chatData;
    }

    // ─── Core: open the reader popup ───
    async function openReader(filename) {
        try {
            const chatData = await fetchChatData(filename);
            if (!chatData) return;

            const result = await renderChatPopup(filename, chatData);

            console.log("[Chat Reader] Popup result:", result, "type:", typeof result);

            // callGenericPopup returns POPUP_RESULT.AFFIRMATIVE (1) for okButton
            if (result === true || result === 1 || result === 'ok' || result === 'affirmative') {
                console.log("[Chat Reader] User wants to go to chat:", filename);
                await goToChat(filename);
            }

        } catch (error) {
            console.error("[Chat Reader] Error:", error);
            toastr.error("Could not load chat for reading.");
        }
    }

    // ─── Close the Manage Chat popup if it's open ───
    function closeManageChatPopup() {
        const shadow = $('#shadow_select_chat_popup');
        if (shadow.length && shadow.css('display') !== 'none') {
            console.log("[Chat Reader] Closing Manage Chat popup");
            $('#select_chat_cross').trigger('click');
        }
    }

    // ─── Navigate to the selected chat ───
    async function goToChat(filename) {
        const cleanName = filename.replace(/\.jsonl$/, '');

        try {
            const context = window.SillyTavern.getContext();
            const groupId = context.selectedGroup || context.groupId;
            const groups = context.groups;

            // ── Strategy 0: Group Chat specific handling ──
            if (groupId && groups) {
                console.log("[Chat Reader] Detected Group context, using popup navigation for reliability.");

                // Temporarily disable reader mode so the switch works
                const wasReaderMode = isReaderMode;
                if (wasReaderMode) deactivateReaderMode();

                // Use the popup method which physically clicks the chat block - most reliable
                await goToChatViaPopup(cleanName);

                if (wasReaderMode) activateReaderMode();
                return;
            }


            // Debug
            const fns = Object.keys(context).filter(k => typeof context[k] === 'function').sort();
            console.log("[Chat Reader] Available context functions:", fns);

            const chatFns = fns.filter(f => /chat|open|select|switch|load/i.test(f));
            console.log("[Chat Reader] Chat-related functions:", chatFns);

            // ── Strategy 1: Direct API functions ──
            const tryFunctions = [
                { obj: context, name: 'openCharacterChat' },
                { obj: context, name: 'selectChat' },
                { obj: context, name: 'loadChat' },
                { obj: context, name: 'switchChat' },
                { obj: context, name: 'changeChat' },
                { obj: window, name: 'openCharacterChat' },
                { obj: window, name: 'selectChat' },
                { obj: window, name: 'loadChat' },
            ];

            for (const { obj, name } of tryFunctions) {
                if (typeof obj[name] === 'function') {
                    console.log(`[Chat Reader] Trying ${name}()`);
                    try {
                        // Temporarily disable reader mode so the dropdown switch works
                        const wasReaderMode = isReaderMode;
                        if (wasReaderMode) deactivateReaderMode();

                        await obj[name](cleanName);

                        if (wasReaderMode) activateReaderMode();

                        // Update the stored original value
                        const mainDropdown = $('#extensionTopBarChatName');
                        if (mainDropdown.length) {
                            mainDropdown.data('reader-original-value', mainDropdown.val());
                        }

                        closeManageChatPopup();
                        toastr.success("Switched to: " + cleanName);
                        return;
                    } catch (e) {
                        console.warn(`[Chat Reader] ${name}() failed:`, e);
                    }
                }
            }

            // ── Strategy 2: Use the main top-bar dropdown ──
            console.log("[Chat Reader] Trying dropdown strategy");
            const mainDropdown = $('#extensionTopBarChatName');
            if (mainDropdown.length) {
                const allValues = [];
                mainDropdown.find('option').each(function () {
                    allValues.push($(this).val());
                });
                console.log("[Chat Reader] Dropdown option values:", allValues);

                const match = allValues.find(v =>
                    v === cleanName ||
                    v === cleanName + '.jsonl' ||
                    v.endsWith(cleanName) ||
                    v.endsWith(cleanName + '.jsonl')
                );

                if (match) {
                    console.log("[Chat Reader] Found dropdown match:", match);

                    const wasReaderMode = isReaderMode;
                    if (wasReaderMode) deactivateReaderMode();

                    mainDropdown.val(match).trigger('change');
                    await new Promise(resolve => setTimeout(resolve, 800));

                    if (wasReaderMode) {
                        activateReaderMode();
                        mainDropdown.data('reader-original-value', mainDropdown.val());
                    }

                    closeManageChatPopup();
                    toastr.success("Switched to: " + cleanName);
                    return;
                }
            }

            // ── Strategy 3: Open Manage Chat popup and click ──
            console.log("[Chat Reader] Last resort: Manage Chat popup");
            await goToChatViaPopup(cleanName);

        } catch (err) {
            console.error("[Chat Reader] Error switching chat:", err);
            toastr.error("Failed to switch chat. Check browser console (F12) for details.");
        }
    }

    // ─── Fallback: navigate via the Manage Chat popup ───
    async function goToChatViaPopup(cleanName) {
        const shadow = $('#shadow_select_chat_popup');

        // Hide the popup visually while we work (prevents flash)
        const originalDisplay = shadow.css('display');
        shadow.css('visibility', 'hidden');

        // Only open if not already open
        if (!shadow.length || originalDisplay === 'none') {
            const manageChatBtn = $('#option_select_chat');
            if (!manageChatBtn.length) {
                shadow.css('visibility', '');
                toastr.error("Could not find Manage Chat button.");
                return;
            }
            manageChatBtn.trigger('click');
            await new Promise(resolve => setTimeout(resolve, 1500));
            // Hide after it opens
            $('#shadow_select_chat_popup').css('visibility', 'hidden');
        }

        console.log("[Chat Reader] Looking for chat block:", cleanName);
        const allBlocks = [];
        $(`.select_chat_block`).each(function () {
            allBlocks.push($(this).attr('file_name'));
        });
        console.log("[Chat Reader] Available blocks:", allBlocks);

        let chatBlock = $(`.select_chat_block[file_name="${cleanName}"]`).first();

        // Try partial match if exact match fails
        if (chatBlock.length === 0) {
            const partialMatch = allBlocks.find(b =>
                b && (b.includes(cleanName) || cleanName.includes(b))
            );
            if (partialMatch) {
                chatBlock = $(`.select_chat_block[file_name="${partialMatch}"]`).first();
            }
        }

        if (chatBlock.length === 0) {
            $('#shadow_select_chat_popup').css('visibility', '');
            closeManageChatPopup();
            toastr.error("Chat not found: " + cleanName);
            return;
        }

        // Temporarily disable reader mode
        const wasReaderMode = isReaderMode;
        if (wasReaderMode) deactivateReaderMode();

        chatBlock.trigger('click');
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (wasReaderMode) {
            activateReaderMode();
            const mainDropdown = $('#extensionTopBarChatName');
            if (mainDropdown.length) {
                mainDropdown.data('reader-original-value', mainDropdown.val());
            }
        }

        // Restore visibility and close the manage chat popup
        $('#shadow_select_chat_popup').css('visibility', '');
        closeManageChatPopup();
        toastr.success("Switched to: " + cleanName);
    }

    // ─── Render the chat reader popup ───
    async function renderChatPopup(title, chatData) {
        const container = $('<div class="chat-reader-container"></div>');

        console.log("[Chat Reader] Rendering chat data:", chatData.length, "items");

        chatData.forEach((item, index) => {
            // Skip header if it's the first item and doesn't look like a message
            if (index === 0 && !item.mes && item.user_name) return;

            // In some versions, 'mes' might be 'message' or empty
            const messageText = item.mes || item.message || "";

            if (!messageText) {
                // console.log("[Chat Reader] Skipping empty message item at index", index, item);
                return;
            }

            const msgClass = item.is_user ? 'user' : 'char';
            const msgDiv = $(`<div class="chat-reader-msg ${msgClass}"></div>`);

            // For groups, item.name is crucial. For single chats, it might be omitted for the char.
            let displayName = item.name;
            if (!displayName) {
                displayName = item.is_user ? (item.send_date ? "User" : "System") : "Character";
            }

            const nameDiv = $(`<div class="chat-reader-name"></div>`).text(displayName);
            const textDiv = $(`<div class="chat-reader-text"></div>`).text(messageText);

            msgDiv.append(nameDiv).append(textDiv);

            if (item.send_date) {
                const dateDiv = $(`<div class="chat-reader-date"></div>`).text(
                    new Date(item.send_date).toLocaleString()
                );
                msgDiv.append(dateDiv);
            }

            container.append(msgDiv);
        });

        if (container.children().length === 0) {
            container.append('<div style="text-align:center; opacity:0.5;">[Chat is empty or format unrecognized]</div>');
            console.warn("[Chat Reader] Container empty after rendering.");
        }

        const context = window.SillyTavern.getContext();
        const result = await context.callGenericPopup(container, context.POPUP_TYPE.TEXT, "", {
            wide: true,
            large: true,
            okButton: "Go To Chat",
            cancelButton: "Close",
        });

        return result;
    }

    // ─── Event delegation: book icon in Manage Chat Files list ───
    $(document).on('click', '.chatReaderButton', function (e) {
        e.stopPropagation();
        e.preventDefault();

        // Try to find the filename in the standard list
        let filename = $(this).closest('.select_chat_block_wrapper')
            .find('.select_chat_block_filename').text().trim();

        // If empty (maybe group chat list structure is different?), try to find it via attribute
        if (!filename) {
            filename = $(this).closest('.select_chat_block').attr('file_name');
        }

        // Clean up any extra text if the selector grabbed too much
        if (filename && filename.includes('\n')) {
            filename = filename.split('\n')[0].trim();
        }

        console.log("[Chat Reader] Validating side-list click:", filename);

        if (filename) {
            openReader(filename);
        } else {
            toastr.error("Could not determine filename.");
        }
    });

    // ─── Init ───
    function init() {
        if (window.SillyTavern && window.SillyTavern.getContext) {
            injectCSS();
            injectButton();
            injectReaderMode();

            setInterval(() => {
                injectButton();
                injectReaderMode();
            }, 500);

            console.log("[Chat Reader] Initialized successfully.");
        } else {
            setTimeout(init, 200);
        }
    }

    $(document).ready(init);
})();
