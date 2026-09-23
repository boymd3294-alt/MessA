"use strict";

/* =========================================================
   MESSA
   COMPLETE FRONTEND APPLICATION
   Supabase + Vanilla JS
========================================================= */


/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
    "https://gjbycnoxocobfpojbxge.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_daUq4Mx-LSKZlOoN6PjJxw_tP5WfFJa";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);


/* =========================================================
   HELPERS
========================================================= */

const $ = selector => document.querySelector(selector);

const $$ = selector =>
    [...document.querySelectorAll(selector)];


function esc(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {
    return esc(value);
}


function initials(name) {

    if (!name) {
        return "?";
    }

    const parts = String(name)
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (!parts.length) {
        return "?";
    }

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


function avatarHTML(profile, size = "medium") {

    const name =
        profile?.display_name ||
        profile?.username ||
        "User";

    const avatarUrl =
        profile?.avatar_url ||
        profile?.avatar ||
        null;

    if (avatarUrl) {

        return `
            <div class="avatar avatar-${size}">
                <img
                    src="${escapeAttribute(avatarUrl)}"
                    alt="${escapeAttribute(name)}"
                    loading="lazy"
                >
            </div>
        `;
    }

    return `
        <div class="avatar avatar-${size}">
            ${esc(initials(name))}
        </div>
    `;
}


function formatDate(dateValue) {

    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const now = new Date();

    const diff =
        Math.floor(
            (now.getTime() - date.getTime()) / 1000
        );

    if (diff < 30) {
        return "most";
    }

    if (diff < 60) {
        return `${diff} mp`;
    }

    if (diff < 3600) {
        return `${Math.floor(diff / 60)} perce`;
    }

    if (diff < 86400) {
        return `${Math.floor(diff / 3600)} órája`;
    }

    if (diff < 604800) {
        return `${Math.floor(diff / 86400)} napja`;
    }

    return date.toLocaleDateString(
        "hu-HU",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


function formatTime(dateValue) {

    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString(
        "hu-HU",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function toast(
    message,
    title = "Messa",
    icon = "fa-circle-check"
) {

    const container = $("#toastContainer");

    if (!container) {
        return;
    }

    const item = document.createElement("div");

    item.className = "toast";

    item.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid ${icon}"></i>
        </div>

        <div class="toast-content">
            <strong>${esc(title)}</strong>
            <span>${esc(message)}</span>
        </div>
    `;

    container.appendChild(item);

    setTimeout(() => {

        item.remove();

    }, 4100);
}


function loadingHTML(text = "Betöltés...") {

    return `
        <div class="loading-screen">
            <div class="loading-spinner"></div>
            <span>${esc(text)}</span>
        </div>
    `;
}


function emptyHTML(
    title,
    text,
    icon = "fa-inbox"
) {

    return `
        <div class="empty-state">

            <div class="empty-state-icon">
                <i class="fa-solid ${icon}"></i>
            </div>

            <h3>${esc(title)}</h3>

            <p>${esc(text)}</p>

        </div>
    `;
}


function errorHTML(
    title = "Hiba történt",
    text = "Próbáld újra később."
) {

    return `
        <div class="error-state">

            <div class="error-state-icon">
                <i class="fa-solid fa-triangle-exclamation"></i>
            </div>

            <h3>${esc(title)}</h3>

            <p>${esc(text)}</p>

        </div>
    `;
}


function setContent(html) {

    const content = $("#content");

    if (!content) {
        return;
    }

    content.innerHTML = html;
}


function stopEvent(event) {
    event.preventDefault();
    event.stopPropagation();
}


/* =========================================================
   APPLICATION STATE
========================================================= */

const state = {

    user: null,

    profile: null,

    view: "home",

    viewedProfileId: null,

    chatUser: null,

    conversations: [],

    notifications: [],

    realtimeChannel: null,

    realtimeStarted: false,

    authMode: "login",

    searchTimer: null,

    currentPostForComments: null,

    currentComments: [],

    mobileChatOpen: false

};


/* =========================================================
   AUTH
========================================================= */

function setAuthMode(mode) {

    state.authMode = mode;

    const loginTab = $("#loginTab");
    const signupTab = $("#signupTab");
    const signupFields = $("#signupFields");
    const submit = $("#authSubmit");

    if (!loginTab || !signupTab || !signupFields || !submit) {
        return;
    }

    const isSignup = mode === "signup";

    loginTab.classList.toggle(
        "active",
        !isSignup
    );

    signupTab.classList.toggle(
        "active",
        isSignup
    );

    signupFields.classList.toggle(
        "hidden",
        !isSignup
    );

    submit.querySelector("span").textContent =
        isSignup
            ? "Regisztráció"
            : "Bejelentkezés";

    const password =
        $("#authPassword");

    if (password) {

        password.autocomplete =
            isSignup
                ? "new-password"
                : "current-password";
    }

    clearAuthMessage();
}


function showAuthMessage(
    message,
    type = "error"
) {

    const box = $("#authMessage");

    if (!box) {
        return;
    }

    box.textContent = message;

    box.style.color =
        type === "success"
            ? "var(--success)"
            : "var(--danger)";
}


function clearAuthMessage() {

    const box = $("#authMessage");

    if (box) {
        box.textContent = "";
    }
}


async function handleAuthSubmit(event) {

    event.preventDefault();

    const email =
        $("#authEmail")?.value.trim();

    const password =
        $("#authPassword")?.value;

    const username =
        $("#authUsername")?.value.trim();

    const button =
        $("#authSubmit");

    if (!email || !password) {

        showAuthMessage(
            "Add meg az e-mail címedet és a jelszavadat."
        );

        return;
    }

    if (
        state.authMode === "signup" &&
        !username
    ) {

        showAuthMessage(
            "A felhasználónév megadása kötelező."
        );

        return;
    }

    button.disabled = true;

    button.querySelector("span").textContent =
        state.authMode === "signup"
            ? "Regisztráció..."
            : "Bejelentkezés...";

    clearAuthMessage();

    try {

        if (state.authMode === "login") {

            const result =
                await db.auth.signInWithPassword({
                    email,
                    password
                });

            if (result.error) {
                throw result.error;
            }

            showAuthMessage(
                "Sikeres bejelentkezés.",
                "success"
            );

        } else {

            const result =
                await db.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username
                        }
                    }
                });

            if (result.error) {
                throw result.error;
            }

            if (result.data?.session) {

                showAuthMessage(
                    "Sikeres regisztráció.",
                    "success"
                );

            } else {

                showAuthMessage(
                    "A regisztráció sikeres. Ellenőrizd az e-mail címedet.",
                    "success"
                );
            }
        }

    } catch (error) {

        console.error(
            "Authentication error:",
            error
        );

        showAuthMessage(
            getSupabaseErrorMessage(error)
        );

    } finally {

        button.disabled = false;

        button.querySelector("span").textContent =
            state.authMode === "signup"
                ? "Regisztráció"
                : "Bejelentkezés";
    }
}


function getSupabaseErrorMessage(error) {

    if (!error) {
        return "Ismeretlen hiba történt.";
    }

    const message =
        String(
            error.message ||
            error.error_description ||
            error
        );

    if (
        message.toLowerCase().includes("invalid login")
    ) {
        return "Hibás e-mail cím vagy jelszó.";
    }

    if (
        message.toLowerCase().includes("already registered")
    ) {
        return "Ez az e-mail cím már regisztrálva van.";
    }

    if (
        message.toLowerCase().includes("password")
    ) {
        return "A jelszó nem megfelelő vagy túl rövid.";
    }

    return message;
}


async function logout() {

    try {

        await stopRealtime();

        const result =
            await db.auth.signOut();

        if (result.error) {
            throw result.error;
        }

        state.user = null;
        state.profile = null;
        state.chatUser = null;
        state.viewedProfileId = null;

        showAuthScreen();

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        toast(
            "A kijelentkezés nem sikerült.",
            "Hiba",
            "fa-triangle-exclamation"
        );
    }
}


/* =========================================================
   AUTH SCREEN / APP SCREEN
========================================================= */

function showAuthScreen() {

    $("#authScreen")?.classList.remove("hidden");

    $("#appShell")?.classList.add("hidden");
}


function showAppScreen() {

    $("#authScreen")?.classList.add("hidden");

    $("#appShell")?.classList.remove("hidden");
}


/* =========================================================
   PROFILE
========================================================= */

async function loadProfile(userId = state.user?.id) {

    if (!userId) {
        return null;
    }

    const result =
        await db
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

    if (result.error) {

        console.error(
            "Profile load error:",
            result.error
        );

        return null;
    }

    return result.data;
}


async function ensureProfile() {

    if (!state.user) {
        return;
    }

    let profile =
        await loadProfile(
            state.user.id
        );

    if (!profile) {

        const username =
            state.user.user_metadata?.username ||
            `user_${state.user.id.slice(0, 8)}`;

        const insertResult =
            await db
                .from("profiles")
                .insert({
                    id: state.user.id,
                    username
                })
                .select()
                .maybeSingle();

        if (!insertResult.error) {
            profile = insertResult.data;
        }
    }

    state.profile = profile;
}


function updateUserChrome() {

    const profile =
        state.profile || {};

    const name =
        profile.display_name ||
        profile.username ||
        state.user?.email ||
        "Felhasználó";

    const sidebarName =
        $("#sidebarUsername");

    if (sidebarName) {
        sidebarName.textContent = name;
    }

    const sidebarAvatar =
        $("#sidebarAvatar");

    if (sidebarAvatar) {

        sidebarAvatar.outerHTML =
            avatarHTML(
                profile,
                "small"
            ).replace(
                'class="avatar avatar-small"',
                'id="sidebarAvatar" class="avatar avatar-small"'
            );
    }

    const topbarAvatar =
        $("#topbarAvatar");

    if (topbarAvatar) {

        topbarAvatar.outerHTML =
            avatarHTML(
                profile,
                "small"
            ).replace(
                'class="avatar avatar-small"',
                'id="topbarAvatar" class="avatar avatar-small"'
            );
    }
}


/* =========================================================
   NAVIGATION
========================================================= */

function navigate(view, options = {}) {

    if (!state.user) {
        return;
    }

    state.view = view;

    if (
        Object.prototype.hasOwnProperty.call(
            options,
            "profileId"
        )
    ) {
        state.viewedProfileId =
            options.profileId;
    }

    if (
        Object.prototype.hasOwnProperty.call(
            options,
            "chatUser"
        )
    ) {
        state.chatUser =
            options.chatUser;
    }

    updateNavigation();

    closeMobileMenu();

    switch (view) {

        case "home":
            renderHome();
            break;

        case "explore":
            renderExplore();
            break;

        case "messages":
            renderMessages();
            break;

        case "notifications":
            renderNotifications();
            break;

        case "communities":
            renderCommunities();
            break;

        case "profile":
            renderProfile(
                state.viewedProfileId ||
                state.user.id
            );
            break;

        case "settings":
            renderSettings();
            break;

        default:
            renderHome();
            break;
    }
}


function updateNavigation() {

    $$(".nav-item[data-view], .mobile-nav-item[data-view]")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.view === state.view
            );
        });
}


/* =========================================================
   HOME
========================================================= */

async function renderHome() {

    setContent(
        loadingHTML("A főoldal betöltése...")
    );

    const postsResult =
        await db
            .from("posts")
            .select(`
                *,
                profiles (
                    id,
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(50);

    if (postsResult.error) {

        console.error(
            "Posts load error:",
            postsResult.error
        );

        setContent(
            errorHTML(
                "Nem sikerült betölteni a feedet.",
                postsResult.error.message
            )
        );

        return;
    }

    const posts =
        postsResult.data || [];

    if (!posts.length) {

        setContent(`
            ${renderCreatePostButton()}

            ${emptyHTML(
                "Még nincs bejegyzés",
                "A Messa feedje még üres. Hozd létre az első valódi bejegyzést!",
                "fa-pen"
            )}
        `);

        return;
    }

    const postIds =
        posts.map(post => post.id);

    const likesResult =
        await db
            .from("post_likes")
            .select("post_id,user_id")
            .in(
                "post_id",
                postIds
            );

    const commentsResult =
        await db
            .from("comments")
            .select(`
                *,
                profiles (
                    id,
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .in(
                "post_id",
                postIds
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

    const likes =
        likesResult.error
            ? []
            : likesResult.data || [];

    const comments =
        commentsResult.error
            ? []
            : commentsResult.data || [];

    setContent(`

        ${renderCreatePostButton()}

        <div class="feed-list">

            ${posts
                .map(post =>
                    postHtml(
                        post,
                        likes,
                        comments
                    )
                )
                .join("")}

        </div>

    `);
}


function renderCreatePostButton() {

    const profile =
        state.profile || {};

    return `

        <div class="post-creator">

            ${avatarHTML(
                profile,
                "small"
            )}

            <div class="post-creator-main">

                <button
                    type="button"
                    class="post-creator-input"
                    data-action="create-post"
                >
                    Mi jár a fejedben?
                </button>

                <div class="post-creator-actions">

                    <button
                        type="button"
                        class="creator-action"
                        data-action="create-post"
                    >
                        <i class="fa-regular fa-image"></i>
                        Fotó / média
                    </button>

                    <button
                        type="button"
                        class="creator-action"
                        data-action="create-post"
                    >
                        <i class="fa-regular fa-face-smile"></i>
                        Hangulat
                    </button>

                </div>

            </div>

        </div>

    `;
}


/* =========================================================
   POST HTML
========================================================= */

function postHtml(
    post,
    likes = [],
    comments = []
) {

    const profile =
        post.profiles || {};

    const postLikes =
        likes.filter(
            like =>
                like.post_id === post.id
        );

    const postComments =
        comments.filter(
            comment =>
                comment.post_id === post.id
        );

    const liked =
        postLikes.some(
            like =>
                like.user_id === state.user.id
        );

    const content =
        post.content ||
        post.body ||
        "";

    const mediaUrl =
        post.media_url ||
        post.image_url ||
        post.media ||
        null;

    const authorName =
        profile.display_name ||
        profile.username ||
        "Felhasználó";

    return `

        <article
            class="post-card"
            data-post-id="${escapeAttribute(post.id)}"
        >

            <div class="post-header">

                <button
                    type="button"
                    class="post-author-button"
                    data-action="open-profile"
                    data-user-id="${escapeAttribute(profile.id || post.user_id)}"
                >

                    ${avatarHTML(
                        profile,
                        "small"
                    )}

                    <div class="post-author-info">

                        <strong>
                            ${esc(authorName)}
                        </strong>

                        <span>
                            ${formatDate(post.created_at)}
                        </span>

                    </div>

                </button>

                ${
                    post.user_id === state.user.id
                        ? `
                            <button
                                type="button"
                                class="post-more"
                                data-action="delete-post"
                                data-post-id="${escapeAttribute(post.id)}"
                                aria-label="Bejegyzés törlése"
                            >
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>
                        `
                        : ""
                }

            </div>


            <div class="post-body">

                ${
                    content
                        ? `
                            <p class="post-text">
                                ${esc(content)}
                            </p>
                        `
                        : ""
                }

            </div>


            ${
                mediaUrl
                    ? `
                        <img
                            class="post-media"
                            src="${escapeAttribute(mediaUrl)}"
                            alt="Bejegyzés média"
                            loading="lazy"
                        >
                    `
                    : ""
            }


            <div class="post-actions">

                <button
                    type="button"
                    class="post-action ${liked ? "liked" : ""}"
                    data-action="like-post"
                    data-post-id="${escapeAttribute(post.id)}"
                >

                    <i class="${
                        liked
                            ? "fa-solid"
                            : "fa-regular"
                    } fa-heart"></i>

                    <span>
                        ${postLikes.length}
                    </span>

                </button>


                <button
                    type="button"
                    class="post-action"
                    data-action="comments"
                    data-post-id="${escapeAttribute(post.id)}"
                >

                    <i class="fa-regular fa-comment"></i>

                    <span>
                        ${postComments.length}
                    </span>

                </button>

            </div>


            ${
                postComments.length
                    ? `
                        <div class="post-comments-preview">

                            ${postComments
                                .slice(-2)
                                .map(comment => {

                                    const cp =
                                        comment.profiles || {};

                                    return `
                                        <div class="comment-preview">

                                            <strong>
                                                ${esc(
                                                    cp.display_name ||
                                                    cp.username ||
                                                    "Felhasználó"
                                                )}
                                            </strong>

                                            ${esc(
                                                comment.content
                                            )}

                                        </div>
                                    `;

                                })
                                .join("")}

                            ${
                                postComments.length > 2
                                    ? `
                                        <button
                                            type="button"
                                            class="comment-more"
                                            data-action="comments"
                                            data-post-id="${escapeAttribute(post.id)}"
                                        >
                                            Összes komment megtekintése
                                        </button>
                                    `
                                    : ""
                            }

                        </div>
                    `
                    : ""
            }

        </article>

    `;
}


/* =========================================================
   CREATE POST
========================================================= */

function openCreatePostModal() {

    const profile =
        state.profile || {};

    showModal(`

        <div class="modal-header">

            <h3>
                Új bejegyzés
            </h3>

            <button
                type="button"
                class="modal-close"
                data-action="close-modal"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>

        </div>


        <div class="create-post-modal">

            <div class="create-post-user">

                ${avatarHTML(
                    profile,
                    "small"
                )}

                <div class="create-post-user-info">

                    <strong>
                        ${esc(
                            profile.display_name ||
                            profile.username ||
                            "Felhasználó"
                        )}
                    </strong>

                    <span>
                        Nyilvános bejegyzés
                    </span>

                </div>

            </div>


            <textarea
                id="newPostText"
                class="create-post-textarea"
                placeholder="Mi jár a fejedben?"
                maxlength="5000"
            ></textarea>


            <div class="create-post-modal-footer">

                <span class="muted">
                    <i class="fa-solid fa-globe"></i>
                    Nyilvános
                </span>

                <button
                    type="button"
                    id="submitPostButton"
                    class="primary-button post-submit"
                    data-action="submit-post"
                >
                    Közzététel
                </button>

            </div>

        </div>

    `);

    setTimeout(() => {

        $("#newPostText")?.focus();

    }, 50);
}


async function createPost() {

    const textarea =
        $("#newPostText");

    const button =
        $("#submitPostButton");

    if (!textarea || !button) {
        return;
    }

    const content =
        textarea.value.trim();

    if (!content) {

        toast(
            "Írj valamit a bejegyzésbe.",
            "Hiányzó tartalom",
            "fa-pen"
        );

        return;
    }

    button.disabled = true;
    button.textContent = "Közzététel...";

    try {

        const result =
            await db
                .from("posts")
                .insert({
                    user_id: state.user.id,
                    content
                })
                .select()
                .single();

        if (result.error) {
            throw result.error;
        }

        closeModal();

        toast(
            "A bejegyzésed létrejött.",
            "Sikeres közzététel"
        );

        navigate("home");

    } catch (error) {

        console.error(
            "Create post error:",
            error
        );

        toast(
            getSupabaseErrorMessage(error),
            "Nem sikerült létrehozni",
            "fa-triangle-exclamation"
        );

        button.disabled = false;
        button.textContent = "Közzététel";
    }
}


/* =========================================================
   LIKE
========================================================= */

async function toggleLike(postId) {

    if (!postId || !state.user) {
        return;
    }

    const existing =
        await db
            .from("post_likes")
            .select("post_id,user_id")
            .eq("post_id", postId)
            .eq("user_id", state.user.id)
            .maybeSingle();

    if (existing.error) {

        console.error(
            "Like lookup error:",
            existing.error
        );

        return;
    }

    if (existing.data) {

        const result =
            await db
                .from("post_likes")
                .delete()
                .eq("post_id", postId)
                .eq("user_id", state.user.id);

        if (result.error) {

            toast(
                result.error.message,
                "Like hiba",
                "fa-triangle-exclamation"
            );

            return;
        }

    } else {

        const result =
            await db
                .from("post_likes")
                .insert({
                    post_id: postId,
                    user_id: state.user.id
                });

        if (result.error) {

            toast(
                result.error.message,
                "Like hiba",
                "fa-triangle-exclamation"
            );

            return;
        }

        const postResult =
            await db
                .from("posts")
                .select("user_id")
                .eq("id", postId)
                .maybeSingle();

        if (
            !postResult.error &&
            postResult.data
        ) {

            await createNotification(
                postResult.data.user_id,
                "Új kedvelés",
                `${getDisplayName(state.profile)} kedvelte a bejegyzésedet.`
            );
        }
    }

    if (state.view === "home") {
        await renderHome();
    }
}


async function createNotification(
    userId,
    title,
    body
) {

    if (
        !userId ||
        !state.user ||
        userId === state.user.id
    ) {
        return;
    }

    const result =
        await db
            .from("notifications")
            .insert({
                user_id: userId,
                title,
                body
            });

    if (result.error) {

        console.error(
            "Notification insert error:",
            result.error
        );
    }
}


/* =========================================================
   COMMENTS
========================================================= */

async function openComments(postId) {

    state.currentPostForComments =
        postId;

    showModal(
        loadingHTML(
            "Kommentek betöltése..."
        )
    );

    const result =
        await db
            .from("comments")
            .select(`
                *,
                profiles (
                    id,
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .eq("post_id", postId)
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

    if (result.error) {

        showModal(
            errorHTML(
                "Nem sikerült betölteni a kommenteket.",
                result.error.message
            )
        );

        return;
    }

    state.currentComments =
        result.data || [];

    renderCommentsModal();
}


function renderCommentsModal() {

    const comments =
        state.currentComments || [];

    showModal(`

        <div class="modal-header">

            <h3>
                Kommentek
            </h3>

            <button
                type="button"
                class="modal-close"
                data-action="close-modal"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>

        </div>


        <div class="comments-container">

            <div class="comment-list">

                ${
                    comments.length
                        ? comments
                            .map(comment => {

                                const profile =
                                    comment.profiles || {};

                                return `

                                    <div class="comment-item">

                                        ${avatarHTML(
                                            profile,
                                            "small"
                                        )}

                                        <div class="comment-content">

                                            <strong>
                                                ${esc(
                                                    profile.display_name ||
                                                    profile.username ||
                                                    "Felhasználó"
                                                )}
                                            </strong>

                                            <p>
                                                ${esc(
                                                    comment.content
                                                )}
                                            </p>

                                            <time>
                                                ${formatDate(
                                                    comment.created_at
                                                )}
                                            </time>

                                        </div>

                                    </div>

                                `;

                            })
                            .join("")
                        : `
                            ${emptyHTML(
                                "Még nincs komment",
                                "Legyél te az első, aki hozzászól.",
                                "fa-comment"
                            )}
                        `
                }

            </div>


            <form
                id="commentForm"
                class="comment-form"
            >

                <textarea
                    id="commentText"
                    placeholder="Írj egy kommentet..."
                    maxlength="2000"
                    required
                ></textarea>

                <button
                    type="submit"
                    class="comment-send"
                >
                    <i class="fa-solid fa-paper-plane"></i>
                </button>

            </form>

        </div>

    `);

    $("#commentText")?.focus();
}


async function submitComment(event) {

    event.preventDefault();

    const textarea =
        $("#commentText");

    if (!textarea) {
        return;
    }

    const content =
        textarea.value.trim();

    if (!content) {
        return;
    }

    const postId =
        state.currentPostForComments;

    if (!postId) {
        return;
    }

    textarea.disabled = true;

    try {

        const result =
            await db
                .from("comments")
                .insert({
                    post_id: postId,
                    user_id: state.user.id,
                    content
                })
                .select(`
                    *,
                    profiles (
                        id,
                        username,
                        display_name,
                        avatar_url
                    )
                `)
                .single();

        if (result.error) {
            throw result.error;
        }

        state.currentComments.push(
            result.data
        );

        const postResult =
            await db
                .from("posts")
                .select("user_id")
                .eq("id", postId)
                .maybeSingle();

        if (
            !postResult.error &&
            postResult.data
        ) {

            await createNotification(
                postResult.data.user_id,
                "Új komment",
                `${getDisplayName(state.profile)} hozzászólt a bejegyzésedhez.`
            );
        }

        renderCommentsModal();

    } catch (error) {

        console.error(
            "Comment error:",
            error
        );

        toast(
            getSupabaseErrorMessage(error),
            "Komment hiba",
            "fa-triangle-exclamation"
        );

        textarea.disabled = false;
    }
}


/* =========================================================
   PROFILE
========================================================= */

async function openProfile(userId) {

    if (!userId) {
        return;
    }

    state.viewedProfileId =
        userId;

    state.view =
        "profile";

    updateNavigation();

    await renderProfile(userId);
}


async function renderProfile(
    userId = state.viewedProfileId || state.user?.id
) {

    if (!userId) {
        return;
    }

    state.viewedProfileId =
        userId;

    setContent(
        loadingHTML(
            "Profil betöltése..."
        )
    );

    const profileResult =
        await db
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle();

    if (profileResult.error) {

        setContent(
            errorHTML(
                "Profil betöltési hiba",
                profileResult.error.message
            )
        );

        return;
    }

    const profile =
        profileResult.data;

    if (!profile) {

        setContent(
            emptyHTML(
                "A profil nem található",
                "Ez a felhasználói profil nem érhető el.",
                "fa-user-slash"
            )
        );

        return;
    }

    const [
        followersResult,
        followingResult,
        postsResult,
        followResult
    ] = await Promise.all([

        db
            .from("follows")
            .select(
                "follower_id",
                {
                    count: "exact",
                    head: true
                }
            )
            .eq(
                "following_id",
                userId
            ),

        db
            .from("follows")
            .select(
                "following_id",
                {
                    count: "exact",
                    head: true
                }
            )
            .eq(
                "follower_id",
                userId
            ),

        db
            .from("posts")
            .select(`
                *,
                profiles (
                    id,
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .eq(
                "user_id",
                userId
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            ),

        userId !== state.user.id
            ? db
                .from("follows")
                .select("follower_id")
                .eq(
                    "follower_id",
                    state.user.id
                )
                .eq(
                    "following_id",
                    userId
                )
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null
            })
    ]);

    const followers =
        followersResult.count || 0;

    const following =
        followingResult.count || 0;

    const posts =
        postsResult.error
            ? []
            : postsResult.data || [];

    const isFollowing =
        Boolean(
            followResult.data
        );

    const ownProfile =
        userId === state.user.id;

    setContent(`

        <div class="page-header">

            <div>

                <h1 class="page-title">
                    Profil
                </h1>

                <p class="page-subtitle">
                    ${ownProfile
                        ? "A saját profilod"
                        : "Felhasználói profil"
                    }
                </p>

            </div>

        </div>


        <section class="profile-card">

            <div class="profile-cover"></div>

            <div class="profile-main">

                <div class="profile-avatar-wrap">

                    <div class="avatar profile-avatar">

                        ${
                            profile.avatar_url
                                ? `
                                    <img
                                        src="${escapeAttribute(profile.avatar_url)}"
                                        alt="${escapeAttribute(
                                            profile.display_name ||
                                            profile.username ||
                                            "Profil"
                                        )}"
                                    >
                                `
                                : esc(
                                    initials(
                                        profile.display_name ||
                                        profile.username
                                    )
                                )
                        }

                    </div>

                </div>


                <div class="profile-top">

                    <div class="profile-info">

                        <h2 class="profile-name">

                            ${esc(
                                profile.display_name ||
                                profile.username ||
                                "Felhasználó"
                            )}

                        </h2>

                        <div class="profile-username">

                            @${esc(
                                profile.username ||
                                "user"
                            )}

                        </div>

                        ${
                            profile.bio
                                ? `
                                    <p class="profile-bio">
                                        ${esc(profile.bio)}
                                    </p>
                                `
                                : ""
                        }

                    </div>


                    <div class="profile-actions">

                        ${
                            ownProfile
                                ? `
                                    <button
                                        type="button"
                                        class="secondary-button"
                                        data-action="edit-profile"
                                    >
                                        <i class="fa-solid fa-pen"></i>
                                        Profil szerkesztése
                                    </button>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="follow-button ${
                                            isFollowing
                                                ? "following"
                                                : ""
                                        }"
                                        data-action="toggle-follow"
                                        data-user-id="${escapeAttribute(userId)}"
                                    >
                                        ${
                                            isFollowing
                                                ? "Követés leállítása"
                                                : "Követés"
                                        }
                                    </button>

                                    <button
                                        type="button"
                                        class="secondary-button"
                                        data-action="open-chat"
                                        data-user-id="${escapeAttribute(userId)}"
                                    >
                                        <i class="fa-regular fa-comment"></i>
                                        Üzenet
                                    </button>
                                `
                        }

                    </div>

                </div>


                <div class="profile-stats">

                    <div class="profile-stat">

                        <strong>
                            ${posts.length}
                        </strong>

                        <span>
                            Bejegyzés
                        </span>

                    </div>


                    <div class="profile-stat">

                        <strong>
                            ${followers}
                        </strong>

                        <span>
                            Követő
                        </span>

                    </div>


                    <div class="profile-stat">

                        <strong>
                            ${following}
                        </strong>

                        <span>
                            Követés
                        </span>

                    </div>

                </div>

            </div>

        </section>


        <div class="profile-posts-heading">

            <h3>
                Bejegyzések
            </h3>

        </div>


        ${
            posts.length
                ? `
                    <div class="feed-list">

                        ${await renderProfilePosts(
                            posts
                        )}

                    </div>
                `
                : emptyHTML(
                    "Még nincs bejegyzés",
                    "Ezen a profilon még nincs közzétett bejegyzés.",
                    "fa-pen"
                )
        }

    `);
}


async function renderProfilePosts(posts) {

    if (!posts.length) {
        return "";
    }

    const ids =
        posts.map(post => post.id);

    const likesResult =
        await db
            .from("post_likes")
            .select("post_id,user_id")
            .in(
                "post_id",
                ids
            );

    const commentsResult =
        await db
            .from("comments")
            .select(`
                *,
                profiles (
                    id,
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .in(
                "post_id",
                ids
            );

    return posts
        .map(post =>
            postHtml(
                post,
                likesResult.error
                    ? []
                    : likesResult.data || [],
                commentsResult.error
                    ? []
                    : commentsResult.data || []
            )
        )
        .join("");
}


/* =========================================================
   FOLLOW
========================================================= */

async function toggleFollow(userId) {

    if (
        !userId ||
        userId === state.user.id
    ) {
        return;
    }

    const existing =
        await db
            .from("follows")
            .select("follower_id")
            .eq(
                "follower_id",
                state.user.id
            )
            .eq(
                "following_id",
                userId
            )
            .maybeSingle();

    if (existing.error) {

        toast(
            existing.error.message,
            "Követési hiba",
            "fa-triangle-exclamation"
        );

        return;
    }

    if (existing.data) {

        const result =
            await db
                .from("follows")
                .delete()
                .eq(
                    "follower_id",
                    state.user.id
                )
                .eq(
                    "following_id",
                    userId
                );

        if (result.error) {

            toast(
                result.error.message,
                "Követési hiba",
                "fa-triangle-exclamation"
            );

            return;
        }

        toast(
            "Már nem követed ezt a felhasználót.",
            "Követés frissítve"
        );

    } else {

        const result =
            await db
                .from("follows")
                .insert({
                    follower_id: state.user.id,
                    following_id: userId
                });

        if (result.error) {

            toast(
                result.error.message,
                "Követési hiba",
                "fa-triangle-exclamation"
            );

            return;
        }

        await createNotification(
            userId,
            "Új követő",
            `${getDisplayName(state.profile)} követni kezdett.`
        );

        toast(
            "Mostantól követed ezt a felhasználót.",
            "Követés"
        );
    }

    await renderProfile(userId);
}


/* =========================================================
   PROFILE EDIT
========================================================= */

function openEditProfileModal() {

    const profile =
        state.profile || {};

    showModal(`

        <div class="modal-header">

            <h3>
                Profil szerkesztése
            </h3>

            <button
                type="button"
                class="modal-close"
                data-action="close-modal"
            >
                <i class="fa-solid fa-xmark"></i>
            </button>

        </div>


        <form
            id="editProfileForm"
            class="create-post-modal"
        >

            <div class="input-group">

                <label>
                    Felhasználónév
                </label>

                <div class="input-wrapper">

                    <i class="fa-regular fa-user"></i>

                    <input
                        id="editUsername"
                        type="text"
                        maxlength="50"
                        value="${escapeAttribute(
                            profile.username || ""
                        )}"
                    >

                </div>

            </div>


            <div class="input-group">

                <label>
                    Megjelenített név
                </label>

                <div class="input-wrapper">

                    <i class="fa-regular fa-id-card"></i>

                    <input
                        id="editDisplayName"
                        type="text"
                        maxlength="100"
                        value="${escapeAttribute(
                            profile.display_name || ""
                        )}"
                    >

                </div>

            </div>


            <div class="input-group">

                <label>
                    Bemutatkozás
                </label>

                <textarea
                    id="editBio"
                    class="create-post-textarea"
                    style="min-height:110px"
                    maxlength="500"
                >${esc(profile.bio || "")}</textarea>

            </div>


            <div class="create-post-modal-footer">

                <button
                    type="button"
                    class="secondary-button"
                    data-action="close-modal"
                >
                    Mégse
                </button>

                <button
                    type="submit"
                    class="primary-button post-submit"
                >
                    Mentés
                </button>

            </div>

        </form>

    `);
}


async function saveProfile(event) {

    event.preventDefault();

    const username =
        $("#editUsername")?.value.trim();

    const displayName =
        $("#editDisplayName")?.value.trim();

    const bio =
        $("#editBio")?.value.trim();

    if (!username) {

        toast(
            "A felhasználónév nem lehet üres.",
            "Hiba",
            "fa-triangle-exclamation"
        );

        return;
    }

    try {

        const result =
            await db
                .from("profiles")
                .update({
                    username,
                    display_name:
                        displayName || null,
                    bio:
                        bio || null
                })
                .eq(
                    "id",
                    state.user.id
                );

        if (result.error) {
            throw result.error;
        }

        await ensureProfile();

        updateUserChrome();

        closeModal();

        toast(
            "A profilod frissült.",
            "Profil mentve"
        );

        await renderProfile(
            state.user.id
        );

    } catch (error) {

        console.error(
            "Profile update error:",
            error
        );

        toast(
            getSupabaseErrorMessage(error),
            "Profil mentési hiba",
            "fa-triangle-exclamation"
        );
    }
}


/* =========================================================
   EXPLORE
========================================================= */

async function renderExplore(
    searchTerm = ""
) {

    setContent(
        loadingHTML(
            "Felfedezés betöltése..."
        )
    );

    const query =
        searchTerm.trim();

    let usersQuery =
        db
            .from("profiles")
            .select("*")
            .neq(
                "id",
                state.user.id
            )
            .limit(30);

    if (query) {

        usersQuery =
            usersQuery.or(
                `username.ilike.%${query}%,display_name.ilike.%${query}%`
            );
    }

    const usersResult =
        await usersQuery;

    if (usersResult.error) {

        setContent(
            errorHTML(
                "Keresési hiba",
                usersResult.error.message
            )
        );

        return;
    }

    const users =
        usersResult.data || [];

    setContent(`

        <div class="page-header">

            <div>

                <h1 class="page-title">
                    Felfedezés
                </h1>

                <p class="page-subtitle">
                    Találj meg valódi Messa-felhasználókat.
                </p>

            </div>

        </div>


        <form
            id="exploreSearchForm"
            class="explore-search"
        >

            <input
                id="exploreSearchInput"
                type="search"
                value="${escapeAttribute(query)}"
                placeholder="Felhasználó keresése..."
            >

            <button type="submit">
                <i class="fa-solid fa-magnifying-glass"></i>
            </button>

        </form>


        <section class="explore-section">

            <h3>
                ${
                    query
                        ? `Találatok erre: „${esc(query)}”`
                        : "Felhasználók"
                }
            </h3>

            ${
                users.length
                    ? `
                        <div class="explore-users">

                            ${users
                                .map(user => `

                                    <button
                                        type="button"
                                        class="explore-user-card"
                                        data-action="open-profile"
                                        data-user-id="${escapeAttribute(user.id)}"
                                    >

                                        ${avatarHTML(
                                            user,
                                            "medium"
                                        )}

                                        <div class="explore-user-info">

                                            <strong>
                                                ${esc(
                                                    user.display_name ||
                                                    user.username ||
                                                    "Felhasználó"
                                                )}
                                            </strong>

                                            <span>
                                                @${esc(
                                                    user.username ||
                                                    "user"
                                                )}
                                            </span>

                                        </div>

                                    </button>

                                `)
                                .join("")}

                        </div>
                    `
                    : emptyHTML(
                        query
                            ? "Nincs találat"
                            : "Még nincs más felhasználó",
                        query
                            ? "Próbálj más keresési kifejezést."
                            : "Amint mások regisztrálnak, itt jelennek meg.",
                        "fa-user"
                    )
            }

        </section>

    `);
}


/* =========================================================
   MESSAGES
========================================================= */

async function renderMessages() {

    setContent(
        loadingHTML(
            "Üzenetek betöltése..."
        )
    );

    const profilesResult =
        await db
            .from("profiles")
            .select("*")
            .neq(
                "id",
                state.user.id
            );

    const profiles =
        profilesResult.error
            ? []
            : profilesResult.data || [];

    const messagesResult =
        await db
            .from("messages")
            .select("*")
            .or(
                `sender_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            );

    const messages =
        messagesResult.error
            ? []
            : messagesResult.data || [];

    const conversationIds =
        new Set();

    messages.forEach(message => {

        const otherId =
            message.sender_id === state.user.id
                ? message.receiver_id
                : message.sender_id;

        if (otherId) {
            conversationIds.add(otherId);
        }
    });

    const conversationProfiles =
        profiles.filter(
            profile =>
                conversationIds.has(profile.id)
        );

    const selectedUser =
        state.chatUser
            ? profiles.find(
                profile =>
                    profile.id === state.chatUser
            )
            : null;

    setContent(`

        <div class="page-header">

            <div>

                <h1 class="page-title">
                    Üzenetek
                </h1>

                <p class="page-subtitle">
                    Beszélgess a Messa felhasználóival.
                </p>

            </div>

        </div>


        <div
            class="messages-page ${
                selectedUser
                    ? "chat-open"
                    : ""
            }"
            id="messagesPage"
        >

            <div class="conversations">

                <div class="conversations-header">

                    <h3>
                        Beszélgetések
                    </h3>

                </div>


                ${
                    conversationProfiles.length
                        ? conversationProfiles
                            .map(profile => {

                                const lastMessage =
                                    [...messages]
                                        .reverse()
                                        .find(
                                            message =>
                                                (
                                                    message.sender_id === profile.id &&
                                                    message.receiver_id === state.user.id
                                                ) ||
                                                (
                                                    message.sender_id === state.user.id &&
                                                    message.receiver_id === profile.id
                                                )
                                        );

                                return `

                                    <button
                                        type="button"
                                        class="conversation-item ${
                                            state.chatUser === profile.id
                                                ? "active"
                                                : ""
                                        }"
                                        data-action="open-chat"
                                        data-user-id="${escapeAttribute(profile.id)}"
                                    >

                                        ${avatarHTML(
                                            profile,
                                            "small"
                                        )}

                                        <div class="conversation-info">

                                            <strong>
                                                ${esc(
                                                    profile.display_name ||
                                                    profile.username ||
                                                    "Felhasználó"
                                                )}
                                            </strong>

                                            <span class="conversation-preview">

                                                ${
                                                    lastMessage
                                                        ? esc(
                                                            lastMessage.content ||
                                                            ""
                                                        )
                                                        : "Nincs üzenet"
                                                }

                                            </span>

                                        </div>

                                    </button>

                                `;

                            })
                            .join("")
                        : emptyHTML(
                            "Nincs beszélgetés",
                            "Nyiss meg egy profilt és küldj neki üzenetet.",
                            "fa-comment"
                        )
                }

            </div>


            <div class="chat-panel">

                ${
                    selectedUser
                        ? renderChatHeader(
                            selectedUser
                        )
                        : `
                            <div class="chat-empty">

                                <div>

                                    <i
                                        class="fa-regular fa-comments"
                                        style="font-size:30px;margin-bottom:10px"
                                    ></i>

                                    <div>
                                        Válassz egy beszélgetést.
                                    </div>

                                </div>

                            </div>
                        `
                }

                ${
                    selectedUser
                        ? await renderChatBody(
                            selectedUser,
                            messages
                        )
                        : ""
                }

            </div>

        </div>

    `);

    scrollChatToBottom();
}


function renderChatHeader(user) {

    return `

        <div class="chat-header">

            <button
                type="button"
                class="icon-button"
                data-action="close-chat"
                aria-label="Vissza"
            >
                <i class="fa-solid fa-arrow-left"></i>
            </button>

            ${avatarHTML(
                user,
                "small"
            )}

            <div class="chat-header-info">

                <strong>
                    ${esc(
                        user.display_name ||
                        user.username ||
                        "Felhasználó"
                    )}
                </strong>

                <span>
                    @${esc(
                        user.username ||
                        "user"
                    )}
                </span>

            </div>

        </div>

    `;
}


async function renderChatBody(
    selectedUser,
    messages
) {

    const chatMessages =
        messages.filter(message =>

            (
                message.sender_id === state.user.id &&
                message.receiver_id === selectedUser.id
            ) ||
            (
                message.sender_id === selectedUser.id &&
                message.receiver_id === state.user.id
            )

        );

    return `

        <div
            id="chatMessages"
            class="chat-messages"
        >

            ${
                chatMessages.length
                    ? chatMessages
                        .map(
                            renderMessage
                        )
                        .join("")
                    : `
                        <div class="chat-empty">

                            <div>

                                <i
                                    class="fa-regular fa-message"
                                    style="font-size:30px;margin-bottom:10px"
                                ></i>

                                <div>
                                    Még nincs üzenet.
                                </div>

                                <div style="margin-top:5px">
                                    Írd meg az elsőt!
                                </div>

                            </div>

                        </div>
                    `
            }

        </div>


        <form
            id="messageForm"
            class="message-composer"
        >

            <textarea
                id="messageInput"
                placeholder="Írj egy üzenetet..."
                rows="1"
                maxlength="5000"
            ></textarea>

            <button
                type="submit"
                class="send-button"
                aria-label="Üzenet küldése"
            >
                <i class="fa-solid fa-paper-plane"></i>
            </button>

        </form>

    `;
}


function renderMessage(message) {

    const own =
        message.sender_id === state.user.id;

    return `

        <div
            class="message-row ${own ? "own" : "other"}"
            data-message-id="${escapeAttribute(message.id)}"
        >

            <div>

                <div class="message-bubble">

                    <div>
                        ${esc(
                            message.content || ""
                        ).replaceAll("\n", "<br>")}
                    </div>

                    <span class="message-time">

                        ${formatTime(
                            message.created_at
                        )}

                    </span>

                </div>


                ${
                    own
                        ? `
                            <div class="message-actions">

                                <button
                                    type="button"
                                    class="message-action"
                                    data-action="edit-message"
                                    data-message-id="${escapeAttribute(message.id)}"
                                    data-message-content="${escapeAttribute(message.content || "")}"
                                    title="Szerkesztés"
                                >
                                    <i class="fa-solid fa-pen"></i>
                                </button>

                                <button
                                    type="button"
                                    class="message-action"
                                    data-action="delete-message"
                                    data-message-id="${escapeAttribute(message.id)}"
                                    title="Törlés"
                                >
                                    <i class="fa-solid fa-trash"></i>
                                </button>

                            </div>
                        `
                        : ""
                }

            </div>

        </div>

    `;
}


async function openChat(userId) {

    if (
        !userId ||
        userId === state.user.id
    ) {
        return;
    }

    state.chatUser =
        userId;

    state.view =
        "messages";

    updateNavigation();

    await renderMessages();

    setTimeout(
        scrollChatToBottom,
        50
    );

    setTimeout(() => {

        $("#messageInput")?.focus();

    }, 100);
}


function closeChat() {

    state.chatUser = null;

    const page =
        $("#messagesPage");

    if (page) {
        page.classList.remove("chat-open");
    }

    if (window.innerWidth <= 680) {
        renderMessages();
    }
}


async function sendMessage(event) {

    event.preventDefault();

    if (!state.chatUser) {
        return;
    }

    const input =
        $("#messageInput");

    if (!input) {
        return;
    }

    const content =
        input.value.trim();

    if (!content) {
        return;
    }

    input.disabled = true;

    try {

        const result =
            await db
                .from("messages")
                .insert({
                    sender_id: state.user.id,
                    receiver_id: state.chatUser,
                    content
                })
                .select()
                .single();

        if (result.error) {
            throw result.error;
        }

        input.value = "";

        await renderMessages();

        setTimeout(
            scrollChatToBottom,
            30
        );

    } catch (error) {

        console.error(
            "Send message error:",
            error
        );

        toast(
            getSupabaseErrorMessage(error),
            "Üzenetküldési hiba",
            "fa-triangle-exclamation"
        );

    } finally {

        input.disabled = false;

        input.focus();
    }
}


async function editMessage(
    messageId,
    oldContent
) {

    const newContent =
        prompt(
            "Üzenet szerkesztése:",
            oldContent
        );

    if (
        newContent === null
    ) {
        return;
    }

    const content =
        newContent.trim();

    if (!content) {

        toast(
            "Az üzenet nem lehet üres.",
            "Hiba",
            "fa-triangle-exclamation"
        );

        return;
    }

    try {

        const result =
            await db
                .from("messages")
                .update({
                    content
                })
                .eq(
                    "id",
                    messageId
                )
                .eq(
                    "sender_id",
                    state.user.id
                );

        if (result.error) {
            throw result.error;
        }

        toast(
            "Az üzenet frissült.",
            "Üzenet szerkesztve"
        );

        await renderMessages();

    } catch (error) {

        console.error(
            "Edit message error:",
            error
        );

        toast(
            getSupabaseErrorMessage(error),
            "Szerkesztési hiba",
            "fa-triangle-exclamation"
        );
    }
}


async function deleteMessage(
    messageId
) {

    const confirmed =
        confirm(
            "Biztosan törölni szeretnéd ezt az üzenetet?"
        );

    if (!confirmed) {
        return;
    }

    try {

        const result =
            await db
                .from("messages")
                .delete()
                .eq(
                    "id",
                    messageId
                )
                .eq(
                    "sender_id",
                    state.user.id
                );

        if (result.error) {
            throw result.error;
        }

        toast(
            "Az üzenet törölve lett.",
            "Üzenet törölve"
        );

        await renderMessages();

    } catch (error) {

        console.error(
            "Delete message error:",
            error
        );

        toast(
            getSupabaseErrorMessage(error),
            "Törlési hiba",
            "fa-triangle-exclamation"
        );
    }
}


function scrollChatToBottom() {

    const container =
        $("#chatMessages");

    if (!container) {
        return;
    }

    container.scrollTop =
        container.scrollHeight;
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

async function renderNotifications() {

    setContent(
        loadingHTML(
            "Értesítések betöltése..."
        )
    );

    const result =
        await db
            .from("notifications")
            .select("*")
            .eq(
                "user_id",
                state.user.id
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(100);

    if (result.error) {

        setContent(
            errorHTML(
                "Értesítési hiba",
                result.error.message
            )
        );

        return;
    }

    state.notifications =
        result.data || [];

    updateNotificationBadge();

    setContent(`

        <div class="page-header">

            <div>

                <h1 class="page-title">
                    Értesítések
                </h1>

                <p class="page-subtitle">
                    Itt látod a fiókoddal kapcsolatos eseményeket.
                </p>

            </div>

        </div>


        ${
            state.notifications.length
                ? `
                    <div class="notification-list">

                        ${state.notifications
                            .map(
                                notification =>
                                    notificationHTML(
                                        notification
                                    )
                            )
                            .join("")}

                    </div>
                `
                : emptyHTML(
                    "Nincs új értesítés",
                    "Ha valaki interakcióba lép a tartalmaiddal, itt fog megjelenni.",
                    "fa-bell"
                )
        }

    `);
}


function notificationHTML(
    notification
) {

    return `

        <div class="notification-item">

            <div class="notification-icon">

                <i class="fa-regular fa-bell"></i>

            </div>

            <div class="notification-info">

                <strong>
                    ${esc(
                        notification.title ||
                        "Értesítés"
                    )}
                </strong>

                <p>
                    ${esc(
                        notification.body ||
                        ""
                    )}
                </p>

                <time>
                    ${formatDate(
                        notification.created_at
                    )}
                </time>

            </div>

        </div>

    `;
}


async function updateNotificationBadge() {

    if (!state.user) {
        return;
    }

    const result =
        await db
            .from("notifications")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            )
            .eq(
                "user_id",
                state.user.id
            );

    const count =
        result.error
            ? 0
            : result.count || 0;

    const badge =
        $("#notificationBadge");

    if (badge) {

        badge.textContent =
            count > 99
                ? "99+"
                : count;

        badge.classList.toggle(
            "hidden",
            count === 0
        );
    }
}


/* =========================================================
   COMMUNITIES
========================================================= */

async function renderCommunities() {

    setContent(
        loadingHTML(
            "Közösségek betöltése..."
        )
    );

    const communitiesResult =
        await db
            .from("communities")
            .select("*")
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (communitiesResult.error) {

        setContent(
            errorHTML(
                "Közösségi hiba",
                communitiesResult.error.message
            )
        );

        return;
    }

    const communities =
        communitiesResult.data || [];

    if (!communities.length) {

        setContent(`

            <div class="page-header">

                <div>

                    <h1 class="page-title">
                        Közösségek
                    </h1>

                    <p class="page-subtitle">
                        Találj olyan közösségeket, amelyek érdekelnek.
                    </p>

                </div>

            </div>

            ${emptyHTML(
                "Még nincs közösség",
                "Jelenleg nincs létrehozott Messa-közösség.",
                "fa-users"
            )}

        `);

        return;
    }

    const communityIds =
        communities.map(
            community => community.id
        );

    const membersResult =
        await db
            .from("community_members")
            .select(
                "community_id,user_id"
            )
            .in(
                "community_id",
                communityIds
            );

    const members =
        membersResult.error
            ? []
            : membersResult.data || [];

    setContent(`

        <div class="page-header">

            <div>

                <h1 class="page-title">
                    Közösségek
                </h1>

                <p class="page-subtitle">
                    Csatlakozz valódi Messa-közösségekhez.
                </p>

            </div>

        </div>


        <div class="community-grid">

            ${communities
                .map(community => {

                    const communityMembers =
                        members.filter(
                            member =>
                                member.community_id ===
                                community.id
                        );

                    const joined =
                        communityMembers.some(
                            member =>
                                member.user_id ===
                                state.user.id
                        );

                    return `

                        <article class="community-card">

                            <div class="community-card-header">

                                <div class="community-icon">

                                    <i class="fa-solid fa-users"></i>

                                </div>

                                <div class="community-card-info">

                                    <h3>
                                        ${esc(
                                            community.name ||
                                            "Közösség"
                                        )}
                                    </h3>

                                    <span>
                                        ${communityMembers.length}
                                        tag
                                    </span>

                                </div>

                            </div>


                            <p class="community-description">

                                ${esc(
                                    community.description ||
                                    "Még nincs leírás."
                                )}

                            </p>


                            <button
                                type="button"
                                class="community-button ${
                                    joined
                                        ? "joined"
                                        : ""
                                }"
                                data-action="toggle-community"
                                data-community-id="${escapeAttribute(community.id)}"
                                data-joined="${joined ? "true" : "false"}"
                            >

                                ${
                                    joined
                                        ? "Kilépés"
                                        : "Csatlakozás"
                                }

                            </button>

                        </article>

                    `;

                })
                .join("")}

        </div>

    `);
}


async function toggleCommunity(
    communityId,
    joined
) {

    if (!communityId) {
        return;
    }

    try {

        if (joined) {

            const result =
                await db
                    .from("community_members")
                    .delete()
                    .eq(
                        "community_id",
                        communityId
                    )
                    .eq(
                        "user_id",
                        state.user.id
                    );

            if (result.error) {
                throw result.error;
            }

            toast(
                "Kiléptél a közösségből.",
                "Közösség"
            );

        } else {

            const result =
                await db
                    .from("community_members")
                    .insert({
                        community_id:
                            communityId,
                        user_id:
                            state.user.id
                    });

            if (result.error) {
                throw result.error;
            }

            toast(
                "Csatlakoztál a közösséghez.",
                "Közösség"
            );
        }

        await renderCommunities();

    } catch (error) {

        console.error(
            "Community error:",
            error
        );

        toast(
            getSupabaseErrorMessage(error),
            "Közösségi hiba",
            "fa-triangle-exclamation"
        );
    }
}


/* =========================================================
   SETTINGS
========================================================= */

function renderSettings() {

    setContent(`

        <div class="page-header">

            <div>

                <h1 class="page-title">
                    Beállítások
                </h1>

                <p class="page-subtitle">
                    A Messa-fiókod kezelése.
                </p>

            </div>

        </div>


        <div class="settings-list">

            <button
                type="button"
                class="settings-item"
                data-action="edit-profile"
            >

                <div class="settings-item-icon">
                    <i class="fa-solid fa-user-pen"></i>
                </div>

                <div class="settings-item-info">

                    <strong>
                        Profil szerkesztése
                    </strong>

                    <span>
                        Név, felhasználónév és bemutatkozás
                    </span>

                </div>

                <i class="fa-solid fa-chevron-right"></i>

            </button>


            <button
                type="button"
                class="settings-item"
                data-action="logout"
            >

                <div class="settings-item-icon">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </div>

                <div class="settings-item-info">

                    <strong>
                        Kijelentkezés
                    </strong>

                    <span>
                        Kilépés a jelenlegi Messa-fiókból
                    </span>

                </div>

                <i class="fa-solid fa-chevron-right"></i>

            </button>

        </div>

    `);
}


/* =========================================================
   SIDEBAR SUGGESTIONS
========================================================= */

async function loadSidebarSuggestions() {

    if (!state.user) {
        return;
    }

    const peopleContainer =
        $("#peopleSuggestions");

    const communityContainer =
        $("#communitySuggestions");

    if (peopleContainer) {

        const result =
            await db
                .from("profiles")
                .select("*")
                .neq(
                    "id",
                    state.user.id
                )
                .limit(5);

        if (
            !result.error &&
            result.data?.length
        ) {

            peopleContainer.innerHTML =
                result.data
                    .map(profile => `

                        <button
                            type="button"
                            class="person-mini"
                            data-action="open-profile"
                            data-user-id="${escapeAttribute(profile.id)}"
                        >

                            ${avatarHTML(
                                profile,
                                "small"
                            )}

                            <div class="person-mini-info">

                                <strong>
                                    ${esc(
                                        profile.display_name ||
                                        profile.username ||
                                        "Felhasználó"
                                    )}
                                </strong>

                                <span>
                                    @${esc(
                                        profile.username ||
                                        "user"
                                    )}
                                </span>

                            </div>

                        </button>

                    `)
                    .join("");

        } else {

            peopleContainer.innerHTML =
                `
                    <div class="mini-loading">
                        Még nincs más felhasználó.
                    </div>
                `;
        }
    }


    if (communityContainer) {

        const result =
            await db
                .from("communities")
                .select("*")
                .limit(4);

        if (
            !result.error &&
            result.data?.length
        ) {

            communityContainer.innerHTML =
                result.data
                    .map(community => `

                        <button
                            type="button"
                            class="community-mini"
                            data-action="open-communities"
                        >

                            <div class="community-mini-icon">

                                <i class="fa-solid fa-users"></i>

                            </div>

                            <div class="community-mini-info">

                                <strong>
                                    ${esc(
                                        community.name ||
                                        "Közösség"
                                    )}
                                </strong>

                                <span>
                                    Közösség
                                </span>

                            </div>

                        </button>

                    `)
                    .join("");

        } else {

            communityContainer.innerHTML =
                `
                    <div class="mini-loading">
                        Még nincs közösség.
                    </div>
                `;
        }
    }
}


/* =========================================================
   MODAL
========================================================= */

function showModal(content) {

    const overlay =
        $("#modalOverlay");

    const modalContent =
        $("#modalContent");

    if (!overlay || !modalContent) {
        return;
    }

    modalContent.innerHTML =
        content;

    overlay.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";
}


function closeModal() {

    const overlay =
        $("#modalOverlay");

    const modalContent =
        $("#modalContent");

    if (!overlay || !modalContent) {
        return;
    }

    overlay.classList.add(
        "hidden"
    );

    modalContent.innerHTML = "";

    document.body.style.overflow =
        "";
}


/* =========================================================
   MOBILE MENU
========================================================= */

function openMobileMenu() {

    const menu =
        $("#mobileMenu");

    const overlay =
        $("#mobileMenuOverlay");

    if (!menu || !overlay) {
        return;
    }

    menu.classList.add("open");

    overlay.classList.remove(
        "hidden"
    );

    document.body.style.overflow =
        "hidden";
}


function closeMobileMenu() {

    const menu =
        $("#mobileMenu");

    const overlay =
        $("#mobileMenuOverlay");

    if (!menu || !overlay) {
        return;
    }

    menu.classList.remove("open");

    overlay.classList.add(
        "hidden"
    );

    if (
        $("#modalOverlay")?.classList.contains(
            "hidden"
        )
    ) {
        document.body.style.overflow =
            "";
    }
}


/* =========================================================
   GLOBAL SEARCH
========================================================= */

function handleGlobalSearchInput(event) {

    const query =
        event.target.value.trim();

    clearTimeout(
        state.searchTimer
    );

    const results =
        $("#searchResults");

    if (!results) {
        return;
    }

    if (query.length < 2) {

        results.classList.add(
            "hidden"
        );

        results.innerHTML = "";

        return;
    }

    state.searchTimer =
        setTimeout(
            () =>
                performGlobalSearch(
                    query
                ),
            300
        );
}


async function performGlobalSearch(
    query
) {

    const results =
        $("#searchResults");

    if (!results) {
        return;
    }

    results.classList.remove(
        "hidden"
    );

    results.innerHTML =
        `<div class="mini-loading">
            Keresés...
        </div>`;

    const result =
        await db
            .from("profiles")
            .select("*")
            .neq(
                "id",
                state.user.id
            )
            .or(
                `username.ilike.%${query}%,display_name.ilike.%${query}%`
            )
            .limit(8);

    if (result.error) {

        results.innerHTML =
            `<div class="mini-loading">
                Keresési hiba.
            </div>`;

        return;
    }

    const users =
        result.data || [];

    if (!users.length) {

        results.innerHTML =
            `<div class="mini-loading">
                Nincs találat.
            </div>`;

        return;
    }

    results.innerHTML =
        users
            .map(user => `

                <button
                    type="button"
                    class="search-result-item"
                    data-action="open-profile"
                    data-user-id="${escapeAttribute(user.id)}"
                >

                    ${avatarHTML(
                        user,
                        "small"
                    )}

                    <div class="search-result-info">

                        <strong>
                            ${esc(
                                user.display_name ||
                                user.username ||
                                "Felhasználó"
                            )}
                        </strong>

                        <span>
                            @${esc(
                                user.username ||
                                "user"
                            )}
                        </span>

                    </div>

                </button>

            `)
            .join("");
}


/* =========================================================
   DELETE POST
========================================================= */

async function deletePost(
    postId
) {

    const confirmed =
        confirm(
            "Biztosan törölni szeretnéd ezt a bejegyzést?"
        );

    if (!confirmed) {
        return;
    }

    try {

        const result =
            await db
                .from("posts")
                .delete()
                .eq(
                    "id",
                    postId
                )
                .eq(
                    "user_id",
                    state.user.id
                );

        if (result.error) {
            throw result.error;
        }

        toast(
            "A bejegyzés törölve lett.",
            "Bejegyzés törölve"
        );

        if (
            state.view === "profile"
        ) {

            await renderProfile(
                state.viewedProfileId ||
                state.user.id
            );

        } else {

            await renderHome();
        }

    } catch (error) {

        console.error(
            "Delete post error:",
            error
        );

        toast(
            getSupabaseErrorMessage(error),
            "Törlési hiba",
            "fa-triangle-exclamation"
        );
    }
}


/* =========================================================
   DELEGATED CONTENT EVENTS
========================================================= */

async function handleContentClick(
    event
) {

    const target =
        event.target.closest(
            "[data-action]"
        );

    if (!target) {
        return;
    }

    const action =
        target.dataset.action;

    switch (action) {

        case "create-post":

            openCreatePostModal();

            break;


        case "like-post":

            await toggleLike(
                target.dataset.postId
            );

            break;


        case "comments":

            await openComments(
                target.dataset.postId
            );

            break;


        case "open-profile":

            await openProfile(
                target.dataset.userId
            );

            break;


        case "toggle-follow":

            await toggleFollow(
                target.dataset.userId
            );

            break;


        case "open-chat":

            await openChat(
                target.dataset.userId
            );

            break;


        case "close-chat":

            closeChat();

            break;


        case "edit-message":

            await editMessage(
                target.dataset.messageId,
                target.dataset.messageContent || ""
            );

            break;


        case "delete-message":

            await deleteMessage(
                target.dataset.messageId
            );

            break;


        case "edit-profile":

            openEditProfileModal();

            break;


        case "toggle-community":

            await toggleCommunity(
                target.dataset.communityId,
                target.dataset.joined === "true"
            );

            break;


        case "open-communities":

            navigate("communities");

            break;


        case "delete-post":

            await deletePost(
                target.dataset.postId
            );

            break;


        case "submit-post":

            await createPost();

            break;


        case "close-modal":

            closeModal();

            break;


        case "logout":

            await logout();

            break;
    }
}


/* =========================================================
   REALTIME
========================================================= */

async function stopRealtime() {

    if (
        state.realtimeChannel
    ) {

        try {

            await db.removeChannel(
                state.realtimeChannel
            );

        } catch (error) {

            console.error(
                "Realtime cleanup error:",
                error
            );
        }
    }

    state.realtimeChannel = null;

    state.realtimeStarted = false;
}


function startRealtime() {

    if (
        !state.user ||
        state.realtimeStarted
    ) {
        return;
    }

    state.realtimeStarted = true;

    const userId =
        state.user.id;

    const channel =
        db.channel(
            `messa-${userId}-${Date.now()}`
        );


    /* -----------------------------------------------------
       MESSAGES
    ----------------------------------------------------- */

    channel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "messages"
        },
        async payload => {

            const message =
                payload.new ||
                payload.old;

            if (!message) {
                return;
            }

            const relatedToMe =
                message.sender_id === userId ||
                message.receiver_id === userId;

            if (!relatedToMe) {
                return;
            }

            const currentChat =
                state.chatUser;

            const relevantCurrentChat =
                currentChat &&
                (
                    (
                        message.sender_id === userId &&
                        message.receiver_id === currentChat
                    ) ||
                    (
                        message.sender_id === currentChat &&
                        message.receiver_id === userId
                    )
                );

            if (
                state.view === "messages" &&
                relevantCurrentChat
            ) {

                await renderMessages();

                setTimeout(
                    scrollChatToBottom,
                    20
                );

                return;
            }

            if (
                payload.eventType === "INSERT" &&
                message.sender_id !== userId
            ) {

                const senderProfile =
                    await loadProfile(
                        message.sender_id
                    );

                toast(
                    message.content ||
                    "Új üzeneted érkezett.",
                    `Új üzenet – ${
                        senderProfile?.display_name ||
                        senderProfile?.username ||
                        "Felhasználó"
                    }`,
                    "fa-comment"
                );
            }

            if (
                state.view === "messages"
            ) {

                await renderMessages();
            }
        }
    );


    /* -----------------------------------------------------
       POSTS
    ----------------------------------------------------- */

    channel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "posts"
        },
        async () => {

            if (
                state.view === "home"
            ) {

                await renderHome();
            }

            if (
                state.view === "profile"
            ) {

                await renderProfile(
                    state.viewedProfileId ||
                    userId
                );
            }
        }
    );


    /* -----------------------------------------------------
       COMMENTS
    ----------------------------------------------------- */

    channel.on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "comments"
        },
        async payload => {

            const comment =
                payload.new;

            if (!comment) {
                return;
            }

            if (
                comment.user_id === userId
            ) {
                return;
            }

            if (
                state.view === "home"
            ) {

                await renderHome();
            }
        }
    );


    /* -----------------------------------------------------
       LIKES
    ----------------------------------------------------- */

    channel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "post_likes"
        },
        async () => {

            if (
                state.view === "home"
            ) {

                await renderHome();
            }

            if (
                state.view === "profile"
            ) {

                await renderProfile(
                    state.viewedProfileId ||
                    userId
                );
            }
        }
    );


    /* -----------------------------------------------------
       FOLLOWS
    ----------------------------------------------------- */

    channel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "follows"
        },
        async payload => {

            const follow =
                payload.new ||
                payload.old;

            if (!follow) {
                return;
            }

            const related =
                follow.follower_id === userId ||
                follow.following_id === userId;

            if (!related) {
                return;
            }

            if (
                state.view === "profile"
            ) {

                await renderProfile(
                    state.viewedProfileId ||
                    userId
                );
            }
        }
    );


    /* -----------------------------------------------------
       NOTIFICATIONS
    ----------------------------------------------------- */

    channel.on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`
        },
        async payload => {

            const notification =
                payload.new;

            if (!notification) {
                return;
            }

            updateNotificationBadge();

            toast(
                notification.body ||
                "Új értesítés érkezett.",
                notification.title ||
                "Új értesítés",
                "fa-bell"
            );

            if (
                state.view === "notifications"
            ) {

                await renderNotifications();
            }
        }
    );


    /* -----------------------------------------------------
       SUBSCRIBE
    ----------------------------------------------------- */

    channel.subscribe(
        status => {

            console.log(
                "Messa realtime status:",
                status
            );

            if (
                status === "CHANNEL_ERROR"
            ) {

                console.error(
                    "Realtime channel error."
                );
            }
        }
    );

    state.realtimeChannel =
        channel;
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

function setupEventListeners() {

    /* Auth */

    $("#loginTab")
        ?.addEventListener(
            "click",
            () =>
                setAuthMode("login")
        );

    $("#signupTab")
        ?.addEventListener(
            "click",
            () =>
                setAuthMode("signup")
        );

    $("#authForm")
        ?.addEventListener(
            "submit",
            handleAuthSubmit
        );


    /* Password */

    $("#togglePassword")
        ?.addEventListener(
            "click",
            () => {

                const input =
                    $("#authPassword");

                const icon =
                    $("#togglePassword i");

                if (!input || !icon) {
                    return;
                }

                const visible =
                    input.type === "text";

                input.type =
                    visible
                        ? "password"
                        : "text";

                icon.className =
                    visible
                        ? "fa-regular fa-eye"
                        : "fa-regular fa-eye-slash";
            }
        );


    /* Main navigation */

    document.addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-view]"
                );

            if (!button) {
                return;
            }

            const view =
                button.dataset.view;

            if (!view) {
                return;
            }

            stopEvent(event);

            if (
                view === "profile"
            ) {

                state.viewedProfileId =
                    state.user?.id;

            }

            navigate(view);
        }
    );


    /* Content */

    $("#content")
        ?.addEventListener(
            "click",
            handleContentClick
        );


    /* Modal */

    $("#modalOverlay")
        ?.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    $("#modalOverlay")
                ) {

                    closeModal();
                }
            }
        );


    /* Global search */

    $("#globalSearch")
        ?.addEventListener(
            "input",
            handleGlobalSearchInput
        );


    /* Search results close */

    document.addEventListener(
        "click",
        event => {

            const search =
                $("#searchResults");

            const input =
                $("#globalSearch");

            if (
                !search ||
                !input
            ) {
                return;
            }

            if (
                event.target === search ||
                search.contains(event.target) ||
                event.target === input
            ) {
                return;
            }

            search.classList.add(
                "hidden"
            );
        }
    );


    /* Mobile menu */

    $("#mobileMenuButton")
        ?.addEventListener(
            "click",
            openMobileMenu
        );

    $("#closeMobileMenu")
        ?.addEventListener(
            "click",
            closeMobileMenu
        );

    $("#mobileMenuOverlay")
        ?.addEventListener(
            "click",
            closeMobileMenu
        );


    /* Create post buttons */

    $("#sidebarCreatePost")
        ?.addEventListener(
            "click",
            openCreatePostModal
        );

    $("#mobileCreatePost")
        ?.addEventListener(
            "click",
            openCreatePostModal
        );

    $("#mobileBottomCreate")
        ?.addEventListener(
            "click",
            openCreatePostModal
        );


    /* Profile */

    $("#sidebarProfileButton")
        ?.addEventListener(
            "click",
            () => {

                state.viewedProfileId =
                    state.user?.id;

                navigate("profile");
            }
        );


    /* Edit profile form */

    document.addEventListener(
        "submit",
        event => {

            if (
                event.target.id ===
                "editProfileForm"
            ) {

                saveProfile(event);
            }

            if (
                event.target.id ===
                "commentForm"
            ) {

                submitComment(event);
            }

            if (
                event.target.id ===
                "messageForm"
            ) {

                sendMessage(event);
            }

            if (
                event.target.id ===
                "exploreSearchForm"
            ) {

                event.preventDefault();

                const query =
                    $("#exploreSearchInput")
                        ?.value
                        .trim() || "";

                renderExplore(query);
            }
        }
    );


    /* Keyboard */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                if (
                    !$("#modalOverlay")
                        ?.classList.contains(
                            "hidden"
                        )
                ) {

                    closeModal();

                    return;
                }

                closeMobileMenu();
            }
        }
    );


    /* Chat Enter */

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.target.id !==
                "messageInput"
            ) {
                return;
            }

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                $("#messageForm")
                    ?.requestSubmit();
            }
        }
    );


    /* Auto-grow chat input */

    document.addEventListener(
        "input",
        event => {

            if (
                event.target.id !==
                "messageInput"
            ) {
                return;
            }

            const textarea =
                event.target;

            textarea.style.height =
                "auto";

            textarea.style.height =
                Math.min(
                    textarea.scrollHeight,
                    130
                ) + "px";
        }
    );


    /* Logout */

    $("#mobileLogoutButton")
        ?.addEventListener(
            "click",
            logout
        );
}


/* =========================================================
   BOOT
========================================================= */

async function boot() {

    console.log(
        "Messa booting..."
    );

    setupEventListeners();

    const sessionResult =
        await db.auth.getSession();

    if (sessionResult.error) {

        console.error(
            "Session error:",
            sessionResult.error
        );

        showAuthScreen();

        return;
    }

    const session =
        sessionResult.data?.session;

    if (!session) {

        showAuthScreen();

        return;
    }

    state.user =
        session.user;

    await enterApplication();
}


async function enterApplication() {

    if (!state.user) {
        return;
    }

    showAppScreen();

    await ensureProfile();

    updateUserChrome();

    startRealtime();

    await loadSidebarSuggestions();

    await updateNotificationBadge();

    navigate("home");
}


/* =========================================================
   AUTH STATE
========================================================= */

db.auth.onAuthStateChange(
    async (event, session) => {

        console.log(
            "Auth state:",
            event
        );

        if (
            event === "SIGNED_IN" &&
            session
        ) {

            state.user =
                session.user;

            await enterApplication();

            return;
        }

        if (
            event === "SIGNED_OUT"
        ) {

            await stopRealtime();

            state.user = null;
            state.profile = null;
            state.chatUser = null;
            state.viewedProfileId = null;

            showAuthScreen();
        }
    }
);


/* =========================================================
   GLOBAL WINDOW HELPERS
========================================================= */

window.Messa = {

    navigate,

    openProfile,

    openChat,

    closeChat,

    openCreatePostModal,

    closeModal,

    logout

};


/* =========================================================
   START
========================================================= */

boot();
