```javascript
const SUPABASE_URL='https://gjbycnoxocobfpojbxge.supabase.co';
const SUPABASE_KEY='sb_publishable_daUq4Mx-LSKZlOoN6PjJxw_tP5WfFJa';

const db=window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:true
    }
  }
);

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

let state={
  user:null,
  profile:null,
  view:'home',
  chatUser:null,
  profileUserId:null,
  subscriptions:[],
  realtimeStarted:false
};


/* =========================================================
   SEGÉDFÜGGVÉNYEK
========================================================= */

function esc(v=''){
  return String(v).replace(/[&<>'"]/g,c=>({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    "'":'&#39;',
    '"':'&quot;'
  }[c]));
}


function toast(t){

  const el=$('#toast');

  if(!el)return;

  el.textContent=t;
  el.classList.remove('hidden');

  setTimeout(
    ()=>el.classList.add('hidden'),
    2600
  );
}


function avatar(p,cls='avatar'){

  return `
    <div class="${cls}">
      ${
        p?.avatar_url
        ? `<img src="${esc(p.avatar_url)}" alt="">`
        : esc(
            (p?.username||'?')
              .slice(0,1)
              .toUpperCase()
          )
      }
    </div>
  `;
}


function showAuthMsg(t,ok=false){

  $('#authMsg').textContent=t;

  $('#authMsg').className=
    'msg'+(ok?' ok':'');

  $('#authMsg').classList.remove('hidden');
}


/* =========================================================
   AUTH
========================================================= */

function setAuthMode(signup){

  $('#loginTab').classList.toggle(
    'active',
    !signup
  );

  $('#signupTab').classList.toggle(
    'active',
    signup
  );

  $('#usernameField').classList.toggle(
    'hidden',
    !signup
  );

  $('#confirmField').classList.toggle(
    'hidden',
    !signup
  );

  $('#username').required=signup;
  $('#confirm').required=signup;

  $('#authBtn').textContent=
    signup
    ? 'Regisztráció'
    : 'Bejelentkezés';

  $('#authMsg').classList.add('hidden');
}


$('#loginTab').onclick=
  ()=>setAuthMode(false);


$('#signupTab').onclick=
  ()=>setAuthMode(true);


$('#authForm').onsubmit=async e=>{

  e.preventDefault();

  const email=
    $('#email').value.trim();

  const password=
    $('#password').value;

  const signup=
    $('#signupTab')
      .classList
      .contains('active');


  if(
    signup &&
    password!==$('#confirm').value
  ){

    showAuthMsg(
      'A két jelszó nem egyezik.'
    );

    return;
  }


  $('#authBtn').disabled=true;

  let r;


  if(signup){

    const username=
      $('#username').value.trim();


    if(!username){

      showAuthMsg(
        'A felhasználónév kötelező.'
      );

      $('#authBtn').disabled=false;

      return;
    }


    r=await db.auth.signUp({

      email,
      password,

      options:{
        data:{
          username
        }
      }

    });

  }else{

    r=await db.auth.signInWithPassword({

      email,
      password

    });

  }


  $('#authBtn').disabled=false;


  if(r.error){

    showAuthMsg(
      r.error.message
    );

    return;
  }


  if(
    signup &&
    !r.data.session
  ){

    showAuthMsg(
      'Sikeres regisztráció. Ellenőrizd az e-mail-fiókodat a megerősítő levélhez.',
      true
    );

  }else{

    await boot(
      r.data.session || {
        user:r.data.user
      }
    );

  }

};


$('#logoutBtn').onclick=async()=>{

  await db.auth.signOut();

};


/* =========================================================
   PROFIL
========================================================= */

async function loadProfile(){

  let {
    data,
    error
  }=await db
    .from('profiles')
    .select('*')
    .eq('id',state.user.id)
    .maybeSingle();


  if(error)throw error;


  if(!data){

    const username=
      state.user.user_metadata?.username ||
      state.user.email.split('@')[0];


    const r=await db
      .from('profiles')
      .insert({

        id:state.user.id,

        username:
          username.slice(0,30)

      })
      .select()
      .single();


    if(r.error)throw r.error;

    data=r.data;
  }


  state.profile=data;

  updateUserChrome();
}


function updateUserChrome(){

  const p=state.profile||{};


  $('#sideName').textContent=
    p.username||'Felhasználó';


  $('#sideEmail').textContent=
    state.user?.email||'';


  $('#rightName').textContent=
    p.username||'Felhasználó';


  $('#sideAvatar').innerHTML=
    p.avatar_url
    ? `<img src="${esc(p.avatar_url)}">`
    : esc(
        (p.username||'?')
          .slice(0,1)
          .toUpperCase()
      );


  $('#rightAvatar').innerHTML=
    p.avatar_url
    ? `<img src="${esc(p.avatar_url)}">`
    : esc(
        (p.username||'?')
          .slice(0,1)
          .toUpperCase()
      );
}


/* =========================================================
   NAVIGÁCIÓ
========================================================= */

function nav(){

  $$('[data-view]').forEach(
    b=>b.classList.toggle(
      'active',
      b.dataset.view===state.view
    )
  );

  render();
}


$$('[data-view]').forEach(
  b=>b.onclick=()=>{

    if(b.dataset.view==='profile'){

      state.profileUserId=
        state.user.id;

    }

    state.view=
      b.dataset.view;

    nav();

  }
);


async function render(){

  if(!state.user)return;


  try{

    if(state.view==='home')
      return renderHome();


    if(state.view==='messages')
      return renderMessages();


    if(state.view==='communities')
      return renderCommunities();


    if(state.view==='notifications')
      return renderNotifications();


    if(state.view==='profile')
      return renderProfile();


    if(state.view==='settings')
      return renderSettings();


  }catch(e){

    console.error(e);

    $('#content').innerHTML=`

      <div class="panel">

        <b>Hiba:</b>

        ${esc(e.message)}

      </div>

    `;

  }
}


/* =========================================================
   ÉRTESÍTÉSEK
========================================================= */

async function createNotification({
  userId,
  title,
  body
}){

  if(
    !userId ||
    userId===state.user.id
  ){

    return;
  }


  const r=await db
    .from('notifications')
    .insert({

      user_id:userId,
      title,
      body

    });


  if(r.error){

    console.error(
      'Értesítés létrehozási hiba:',
      r.error
    );

  }

}


/* =========================================================
   KEZDŐLAP / BEJEGYZÉSEK
========================================================= */

async function renderHome(){

  const {
    data:posts,
    error
  }=await db
    .from('posts')
    .select(`
      id,
      user_id,
      content,
      media_url,
      created_at,
      profiles:user_id(
        id,
        username,
        avatar_url
      )
    `)
    .order(
      'created_at',
      {
        ascending:false
      }
    )
    .limit(50);


  if(error)throw error;


  let html=`

    <div class="page-head">

      <h1>Kezdőlap</h1>

    </div>


    <div class="composer">

      <div class="composer-row">

        ${avatar(state.profile)}

        <textarea
          id="postText"
          placeholder="Mi jár a fejedben?"
        ></textarea>

      </div>


      <div class="actions">

        <label class="secondary">

          📎 Kép/fájl

          <input
            id="postFile"
            type="file"
            accept="image/*,.pdf,.txt,.doc,.docx"
            hidden
          >

        </label>


        <button
          id="postBtn"
          class="primary"
        >

          Közzététel

        </button>

      </div>

    </div>

  `;


  if(!posts?.length){

    html+=`

      <div class="panel empty">

        📝 Még nincs bejegyzés.

        <br>

        <small>
          Az első valódi bejegyzésed itt jelenik meg.
        </small>

      </div>

    `;

  }else{

    for(const p of posts){

      html+=
        await postHtml(p);

    }

  }


  $('#content').innerHTML=html;


  $('#postBtn').onclick=
    createPost;

}


async function postHtml(p){

  const {
    data:comments
  }=await db
    .from('comments')
    .select(`
      id,
      content,
      created_at,
      user_id,
      profiles:user_id(
        id,
        username,
        avatar_url
      )
    `)
    .eq(
      'post_id',
      p.id
    )
    .order(
      'created_at',
      {
        ascending:true
      }
    )
    .limit(20);


  const liked=
    await hasLike(p.id);


  return `

    <article class="post">


      <div class="post-head">


        <div class="user-row">


          <button
            class="profile-avatar-button"
            data-profile="${p.profiles?.id||p.user_id}"
          >

            ${avatar(p.profiles)}

          </button>


          <div>

            <button
              class="profile-link"
              data-profile="${p.profiles?.id||p.user_id}"
            >

              ${esc(
                p.profiles?.username ||
                'Felhasználó'
              )}

            </button>


            <div class="muted">

              ${new Date(
                p.created_at
              ).toLocaleString(
                'hu-HU'
              )}

            </div>

          </div>


        </div>


      </div>


      <div class="post-body">

        ${esc(p.content)}

      </div>


      ${
        p.media_url

        ? `

          <img
            class="post-media"
            src="${esc(p.media_url)}"
            alt="Feltöltött kép"
          >

        `

        :''
      }


      <div class="post-actions">


        <button
          data-like="${p.id}"
        >

          ${
            liked
            ? '❤️'
            : '🤍'
          }

          Tetszik

        </button>


        <button>

          💬 ${comments?.length||0}

        </button>


      </div>


      <div>


        ${
          comments?.map(c=>`

            <div class="comment">


              <button
                class="profile-link"
                data-profile="${c.profiles?.id||c.user_id}"
              >

                ${esc(
                  c.profiles?.username ||
                  'Felhasználó'
                )}

              </button>


              <br>


              ${esc(c.content)}


              <br>


              <small>

                ${new Date(
                  c.created_at
                ).toLocaleString(
                  'hu-HU'
                )}

              </small>


            </div>

          `).join('')||''

        }


      </div>


      <div class="actions">


        <input
          id="commentInput-${p.id}"
          class="search"
          placeholder="Írj hozzászólást..."
        >


        <button
          class="secondary"
          data-sendcomment="${p.id}"
        >

          Küldés

        </button>


      </div>


    </article>

  `;
}


async function hasLike(postId){

  const {
    data
  }=await db
    .from('post_likes')
    .select('post_id')
    .eq(
      'post_id',
      postId
    )
    .eq(
      'user_id',
      state.user.id
    )
    .maybeSingle();


  return !!data;
}


async function createPost(){

  const text=
    $('#postText').value.trim();


  const file=
    $('#postFile').files[0];


  if(!text&&!file){

    toast(
      'Írj valamit vagy válassz fájlt.'
    );

    return;
  }


  let media_url=null;


  if(file){

    const path=
      `${state.user.id}/`+
      `${crypto.randomUUID()}-`+
      `${file.name.replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      )}`;


    const up=
      await db.storage
        .from('media')
        .upload(
          path,
          file,
          {
            upsert:false
          }
        );


    if(up.error){

      toast(
        up.error.message
      );

      return;
    }


    media_url=
      db.storage
        .from('media')
        .getPublicUrl(path)
        .data
        .publicUrl;

  }


  const r=
    await db
      .from('posts')
      .insert({

        user_id:
          state.user.id,

        content:text,

        media_url

      });


  if(r.error){

    toast(
      r.error.message
    );

    return;
  }


  toast(
    'Bejegyzés közzétéve.'
  );


  renderHome();

}


/* =========================================================
   HOME CLICK KEZELÉS
========================================================= */

$('#content').addEventListener(
  'click',
  async e=>{


    /* =========================
       PROFIL
    ========================= */

    const profile=
      e.target.closest(
        '[data-profile]'
      );


    if(profile){

      state.profileUserId=
        profile.dataset.profile;

      state.view='profile';

      nav();

      return;
    }


    /* =========================
       ÜZENET SZERKESZTÉS
    ========================= */

    const editMessageButton=
      e.target.closest(
        '[data-edit-message]'
      );


    if(editMessageButton){

      await editMessage(
        editMessageButton.dataset.editMessage
      );

      return;
    }


    /* =========================
       ÜZENET TÖRLÉS
    ========================= */

    const deleteMessageButton=
      e.target.closest(
        '[data-delete-message]'
      );


    if(deleteMessageButton){

      await deleteMessage(
        deleteMessageButton.dataset.deleteMessage
      );

      return;
    }


    /* =========================
       LIKE
    ========================= */

    const like=
      e.target.closest(
        '[data-like]'
      );


    if(like){

      const id=
        like.dataset.like;


      const liked=
        await hasLike(id);


      if(liked){

        const r=
          await db
            .from('post_likes')
            .delete()
            .eq(
              'post_id',
              id
            )
            .eq(
              'user_id',
              state.user.id
            );


        if(r.error){

          toast(
            r.error.message
          );

          return;
        }


      }else{

        const r=
          await db
            .from('post_likes')
            .insert({

              post_id:id,

              user_id:
                state.user.id

            });


        if(r.error){

          toast(
            r.error.message
          );

          return;
        }


        const {
          data:post
        }=await db
          .from('posts')
          .select(
            'user_id'
          )
          .eq(
            'id',
            id
          )
          .single();


        if(post){

          await createNotification({

            userId:
              post.user_id,

            title:
              '❤️ Új kedvelés',

            body:
              `${state.profile.username} kedvelte a bejegyzésedet.`

          });

        }

      }


      renderHome();

      return;
    }


    /* =========================
       KOMMENT
    ========================= */

    const send=
      e.target.closest(
        '[data-sendcomment]'
      );


    if(send){

      const id=
        send.dataset.sendcomment;


      const input=
        $(`#commentInput-${id}`);


      const content=
        input.value.trim();


      if(!content)return;


      const r=
        await db
          .from('comments')
          .insert({

            post_id:id,

            user_id:
              state.user.id,

            content

          });


      if(r.error){

        toast(
          r.error.message
        );

        return;
      }


      const {
        data:post
      }=await db
        .from('posts')
        .select(
          'user_id'
        )
        .eq(
          'id',
          id
        )
        .single();


      if(post){

        await createNotification({

          userId:
            post.user_id,

          title:
            '💬 Új hozzászólás',

          body:
            `${state.profile.username} hozzászólt a bejegyzésedhez.`

        });

      }


      renderHome();

    }

  }
);


/* =========================================================
   ÜZENETEK
========================================================= */

async function renderMessages(){

  const {
    data:people,
    error
  }=await db
    .from('profiles')
    .select(
      'id,username,avatar_url'
    )
    .neq(
      'id',
      state.user.id
    )
    .order('username')
    .limit(100);


  if(error)throw error;


  $('#content').innerHTML=`

    <div class="page-head">

      <h1>Üzenetek</h1>

    </div>


    <div class="chat-grid">


      <div class="chat-list">


        ${
          people?.map(p=>`

            <button
              class="chat-user ${
                state.chatUser===p.id
                  ? 'active'
                  : ''
              }"
              data-chat="${p.id}"
            >

              ${avatar(p)}

              <span>

                ${esc(p.username)}

              </span>

            </button>

          `).join('')

          ||

          `

            <div class="empty">

              Még nincs más regisztrált
              felhasználó.

            </div>

          `
        }


      </div>


      <div class="chat-window">


        ${
          state.chatUser

          ? await chatHtml(
              state.chatUser
            )

          : `

            <div class="empty">

              Válassz egy valódi
              felhasználót a beszélgetéshez.

            </div>

          `
        }


      </div>


    </div>

  `;


  $$('[data-chat]').forEach(
    b=>b.onclick=()=>{

      state.chatUser=
        b.dataset.chat;

      renderMessages();

    }
  );


  if($('#sendMessage')){

    $('#sendMessage').onclick=
      sendMessage;

  }

}


async function chatHtml(other){

  const {
    data:p
  }=await db
    .from('profiles')
    .select(
      'id,username,avatar_url'
    )
    .eq(
      'id',
      other
    )
    .single();


  const {
    data:rows,
    error
  }=await db
    .from('messages')
    .select(`
      id,
      sender_id,
      receiver_id,
      content,
      created_at,
      updated_at
    `)
    .or(
      `and(sender_id.eq.${state.user.id},receiver_id.eq.${other}),and(sender_id.eq.${other},receiver_id.eq.${state.user.id})`
    )
    .order(
      'created_at',
      {
        ascending:true
      }
    )
    .limit(200);


  if(error)throw error;


  return `

    <div class="chat-head">


      ${avatar(p)}


      <div>

        <b>
          ${esc(p.username)}
        </b>

        <div class="muted">
          Üzenetküldés
        </div>

      </div>


    </div>


    <div class="messages">


      ${
        rows?.length

        ? rows.map(m=>{

            const mine=
              m.sender_id===
              state.user.id;


            return `

              <div
                class="message-row ${
                  mine
                  ? 'mine'
                  : ''
                }"
              >


                <div
                  class="bubble ${
                    mine
                    ? 'mine'
                    : ''
                  }"
                >


                  <div>

                    ${esc(
                      m.content
                    )}

                  </div>


                  <small>

                    ${new Date(
                      m.created_at
                    ).toLocaleTimeString(
                      'hu-HU',
                      {
                        hour:'2-digit',
                        minute:'2-digit'
                      }
                    )}


                    ${
                      m.updated_at
                      ? ' · szerkesztve'
                      : ''
                    }

                  </small>


                  ${
                    mine

                    ? `

                      <div
                        class="message-actions"
                      >


                        <button
                          type="button"
                          data-edit-message="${m.id}"
                          title="Üzenet szerkesztése"
                        >
                          ✏️
                        </button>


                        <button
                          type="button"
                          data-delete-message="${m.id}"
                          title="Üzenet törlése"
                        >
                          🗑️
                        </button>


                      </div>

                    `

                    : ''

                  }


                </div>


              </div>

            `;

          }).join('')


        : `

          <div class="empty">

            Még nincs üzenet.

          </div>

        `
      }


    </div>


    <div class="chat-send">


      <input
        id="messageInput"
        placeholder="Írj üzenetet..."
      >


      <button
        id="sendMessage"
        class="primary"
      >

        Küldés

      </button>


    </div>

  `;
}


async function sendMessage(){

  const input=
    $('#messageInput');


  const content=
    input.value.trim();


  if(
    !content ||
    !state.chatUser
  ){

    return;
  }


  const r=
    await db
      .from('messages')
      .insert({

        sender_id:
          state.user.id,

        receiver_id:
          state.chatUser,

        content

      });


  if(r.error){

    toast(
      r.error.message
    );

  }else{

    input.value='';

    await createNotification({

      userId:
        state.chatUser,

      title:
        '💬 Új üzenet',

      body:
        `${state.profile.username} üzenetet küldött neked.`

    });


    renderMessages();

  }

}


/* =========================================================
   ÜZENET SZERKESZTÉSE
========================================================= */

async function editMessage(messageId){

  const {
    data:message,
    error
  }=await db
    .from('messages')
    .select('*')
    .eq(
      'id',
      messageId
    )
    .eq(
      'sender_id',
      state.user.id
    )
    .single();


  if(error){

    toast(
      error.message
    );

    return;
  }


  const newContent=
    prompt(
      'Üzenet módosítása:',
      message.content
    );


  if(newContent===null)
    return;


  const content=
    newContent.trim();


  if(!content){

    toast(
      'Az üzenet nem lehet üres.'
    );

    return;
  }


  const r=
    await db
      .from('messages')
      .update({

        content,

        updated_at:
          new Date().toISOString()

      })
      .eq(
        'id',
        messageId
      )
      .eq(
        'sender_id',
        state.user.id
      );


  if(r.error){

    toast(
      r.error.message
    );

    return;
  }


  toast(
    'Üzenet módosítva.'
  );


  renderMessages();

}


/* =========================================================
   ÜZENET TÖRLÉSE
========================================================= */

async function deleteMessage(messageId){

  const confirmed=
    confirm(
      'Biztosan törölni szeretnéd ezt az üzenetet?'
    );


  if(!confirmed)
    return;


  const r=
    await db
      .from('messages')
      .delete()
      .eq(
        'id',
        messageId
      )
      .eq(
        'sender_id',
        state.user.id
      );


  if(r.error){

    toast(
      r.error.message
    );

    return;
  }


  toast(
    'Üzenet törölve.'
  );


  renderMessages();

}


/* =========================================================
   KÖVETÉS
========================================================= */

async function toggleFollow(userId){

  const {
    data:existing
  }=await db
    .from('follows')
    .select('*')
    .eq(
      'follower_id',
      state.user.id
    )
    .eq(
      'following_id',
      userId
    )
    .maybeSingle();


  if(existing){

    const r=
      await db
        .from('follows')
        .delete()
        .eq(
          'follower_id',
          state.user.id
        )
        .eq(
          'following_id',
          userId
        );


    if(r.error){

      toast(
        r.error.message
      );

      return;
    }


    toast(
      'Követés megszüntetve.'
    );


  }else{

    const r=
      await db
        .from('follows')
        .insert({

          follower_id:
            state.user.id,

          following_id:
            userId

        });


    if(r.error){

      toast(
        r.error.message
      );

      return;
    }


    await createNotification({

      userId,

      title:
        '👤 Új követő',

      body:
        `${state.profile.username} követni kezdett.`

    });


    toast(
      'Mostantól követed ezt a felhasználót.'
    );

  }


  renderProfile();

}


/* =========================================================
   PROFIL
========================================================= */

async function renderProfile(){

  const profileId=
    state.profileUserId ||
    state.user.id;


  const {
    data:p,
    error
  }=await db
    .from('profiles')
    .select('*')
    .eq(
      'id',
      profileId
    )
    .single();


  if(error)throw error;


  const {
    count:followers
  }=await db
    .from('follows')
    .select(
      '*',
      {
        count:'exact',
        head:true
      }
    )
    .eq(
      'following_id',
      profileId
    );


  const {
    count:following
  }=await db
    .from('follows')
    .select(
      '*',
      {
        count:'exact',
        head:true
      }
    )
    .eq(
      'follower_id',
      profileId
    );


  const {
    data:posts
  }=await db
    .from('posts')
    .select('*')
    .eq(
      'user_id',
      profileId
    )
    .order(
      'created_at',
      {
        ascending:false
      }
    );


  const ownProfile=
    profileId===
    state.user.id;


  let followingThisUser=false;


  if(!ownProfile){

    const {
      data:follow
    }=await db
      .from('follows')
      .select('follower_id')
      .eq(
        'follower_id',
        state.user.id
      )
      .eq(
        'following_id',
        profileId
      )
      .maybeSingle();


    followingThisUser=
      !!follow;

  }


  $('#content').innerHTML=`

    <div class="panel">


      <div class="profile-cover"></div>


      <div class="profile-body">


        ${avatar(
          p,
          'avatar profile-avatar'
        )}


        <h1>

          ${esc(p.username)}

        </h1>


        <p class="muted">

          ${esc(p.bio||'')}

        </p>


        <div class="statbar">


          <div class="stat">

            <b>
              ${posts?.length||0}
            </b>

            <span class="muted">
              bejegyzés
            </span>

          </div>


          <div class="stat">

            <b>
              ${followers||0}
            </b>

            <span class="muted">
              követő
            </span>

          </div>


          <div class="stat">

            <b>
              ${following||0}
            </b>

            <span class="muted">
              követés
            </span>

          </div>


        </div>


        ${
          ownProfile

          ? `

            <button
              id="editProfile"
              class="secondary"
            >

              Profil szerkesztése

            </button>

          `

          : `

            <div class="actions">


              <button
                id="profileMessage"
                class="primary"
              >

                💬 Üzenet

              </button>


              <button
                id="profileFollow"
                class="secondary"
              >

                ${
                  followingThisUser
                  ? '✓ Követed'
                  : 'Követés'
                }

              </button>


            </div>

          `
        }


      </div>


    </div>


    <div class="panel">


      <h3>
        Bejegyzések
      </h3>


      ${
        posts?.length

        ? posts.map(post=>`

            <div class="comment">

              ${esc(
                post.content||''
              )}

              ${
                post.media_url
                ? `

                  <br>

                  <img
                    class="post-media"
                    src="${esc(post.media_url)}"
                    alt="Bejegyzés képe"
                  >

                `
                :''
              }


              <br>


              <small>

                ${new Date(
                  post.created_at
                ).toLocaleString(
                  'hu-HU'
                )}

              </small>


            </div>

          `).join('')


        : `

          <div class="empty">

            Még nincs bejegyzése.

          </div>

        `
      }


    </div>

  `;


  if(ownProfile){

    $('#editProfile').onclick=
      ()=>openProfileModal(p);

  }else{

    $('#profileMessage').onclick=()=>{

      state.chatUser=
        profileId;

      state.view=
        'messages';

      nav();

    };


    $('#profileFollow').onclick=
      ()=>toggleFollow(profileId);

  }

}


/* =========================================================
   PROFIL SZERKESZTÉS
========================================================= */

function openProfileModal(p){

  showModal(`

    <h2>
      Profil szerkesztése
    </h2>


    <div class="field">

      <label>
        Felhasználónév
      </label>


      <input
        id="editUsername"
        value="${esc(p.username)}"
      >

    </div>


    <div class="field">

      <label>
        Bemutatkozás
      </label>


      <textarea
        id="editBio"
      >${esc(p.bio||'')}</textarea>

    </div>


    <div class="field">

      <label>
        Profilkép
      </label>


      <input
        id="editAvatar"
        type="file"
        accept="image/*"
      >

    </div>


    <button
      id="saveProfile"
      class="primary"
    >

      Mentés

    </button>


    <button
      onclick="closeModal()"
      class="secondary"
    >

      Mégse

    </button>

  `);


  $('#saveProfile').onclick=
    async()=>{

      let avatar_url=
        p.avatar_url;


      const file=
        $('#editAvatar')
          .files[0];


      if(file){

        const path=
          `${state.user.id}/`+
          `avatar-${crypto.randomUUID()}.`+
          `${file.name.split('.').pop()}`;


        const up=
          await db.storage
            .from('avatars')
            .upload(
              path,
              file,
              {
                upsert:true,
                contentType:file.type
              }
            );


        if(up.error){

          toast(
            up.error.message
          );

          return;
        }


        avatar_url=
          db.storage
            .from('avatars')
            .getPublicUrl(path)
            .data
            .publicUrl;

      }


      const username=
        $('#editUsername')
          .value
          .trim();


      const bio=
        $('#editBio')
          .value
          .trim();


      if(!username){

        toast(
          'A felhasználónév nem lehet üres.'
        );

        return;
      }


      const r=
        await db
          .from('profiles')
          .update({

            username,
            bio,
            avatar_url

          })
          .eq(
            'id',
            state.user.id
          );


      if(r.error){

        toast(
          r.error.message
        );

      }else{

        await loadProfile();

        closeModal();

        renderProfile();

      }

    };

}


/* =========================================================
   KÖZÖSSÉGEK
========================================================= */

async function renderCommunities(){

  const {
    data,
    error
  }=await db
    .from('communities')
    .select('*')
    .order('name');


  if(error)throw error;


  const memberships=
    await db
      .from('community_members')
      .select(
        'community_id'
      )
      .eq(
        'user_id',
        state.user.id
      );


  const ids=
    new Set(
      (memberships.data||[])
        .map(
          x=>x.community_id
        )
    );


  $('#content').innerHTML=`

    <div class="page-head">


      <h1>
        Közösségek
      </h1>


      <button
        id="newCommunity"
        class="primary"
      >

        + Közösség

      </button>


    </div>


    <div class="panel">


      ${
        data?.length

        ? data.map(c=>`

            <div class="community-card">


              <div>

                <div class="community-title">

                  👥 ${esc(c.name)}

                </div>


                <div class="muted">

                  ${esc(
                    c.description||''
                  )}

                </div>

              </div>


              ${
                ids.has(c.id)

                ? `

                  <span class="muted">

                    Tag vagy

                  </span>

                `

                : `

                  <button
                    class="secondary"
                    data-join="${c.id}"
                  >

                    Csatlakozás

                  </button>

                `
              }


            </div>

          `).join('')


        : `

          <div class="empty">

            Még nincs közösség.

          </div>

        `
      }


    </div>

  `;


  $('#newCommunity').onclick=
    openCommunityModal;


  $$('[data-join]').forEach(
    b=>b.onclick=async()=>{

      const r=
        await db
          .from('community_members')
          .insert({

            community_id:
              b.dataset.join,

            user_id:
              state.user.id

          });


      if(r.error){

        toast(
          r.error.message
        );

      }else{

        renderCommunities();

      }

    }
  );

}


function openCommunityModal(){

  showModal(`

    <h2>
      Új közösség
    </h2>


    <div class="field">

      <label>
        Név
      </label>


      <input
        id="communityName"
      >

    </div>


    <div class="field">

      <label>
        Leírás
      </label>


      <textarea
        id="communityDesc"
      ></textarea>

    </div>


    <button
      id="createCommunity"
      class="primary"
    >

      Létrehozás

    </button>


    <button
      onclick="closeModal()"
      class="secondary"
    >

      Mégse

    </button>

  `);


  $('#createCommunity').onclick=
    async()=>{

      const name=
        $('#communityName')
          .value
          .trim();


      const description=
        $('#communityDesc')
          .value
          .trim();


      if(!name)return;


      const r=
        await db
          .from('communities')
          .insert({

            name,
            description,

            created_by:
              state.user.id

          });


      if(r.error){

        toast(
          r.error.message
        );

      }else{

        closeModal();

        renderCommunities();

      }

    };

}


/* =========================================================
   ÉRTESÍTÉSEK OLDAL
========================================================= */

async function renderNotifications(){

  const {
    data,
    error
  }=await db
    .from('notifications')
    .select('*')
    .eq(
      'user_id',
      state.user.id
    )
    .order(
      'created_at',
      {
        ascending:false
      }
    )
    .limit(100);


  if(error)throw error;


  $('#content').innerHTML=`

    <div class="page-head">

      <h1>
        Értesítések
      </h1>

    </div>


    <div class="panel">


      ${
        data?.length

        ? data.map(n=>`

            <div class="community">


              <b>

                ${esc(
                  n.title ||
                  'Értesítés'
                )}

              </b>


              <div>

                ${esc(
                  n.body||''
                )}

              </div>


              <small class="muted">

                ${new Date(
                  n.created_at
                ).toLocaleString(
                  'hu-HU'
                )}

              </small>


            </div>

          `).join('')


        : `

          <div class="empty">

            🔔 Nincs új értesítés.

          </div>

        `
      }


    </div>

  `;

}


/* =========================================================
   BEÁLLÍTÁSOK
========================================================= */

function renderSettings(){

  $('#content').innerHTML=`

    <div class="page-head">

      <h1>
        Beállítások
      </h1>

    </div>


    <div class="panel">

      <h3>
        Fiók
      </h3>


      <p class="muted">

        ${esc(
          state.user.email
        )}

      </p>


      <button
        id="settingsLogout"
        class="danger"
      >

        Kijelentkezés

      </button>

    </div>


    <div class="panel">

      <h3>
        Adatvédelem
      </h3>


      <p class="muted">

        A valódi adatokat a Supabase RLS
        szabályai védik. Titkos service_role
        kulcs nem kerül a böngészőbe.

      </p>

    </div>

  `;


  $('#settingsLogout').onclick=
    ()=>$('#logoutBtn').click();

}


/* =========================================================
   MODAL
========================================================= */

function showModal(html){

  $('#modal').innerHTML=`

    <div class="modal-card">

      ${html}

    </div>

  `;


  $('#modal').classList.remove(
    'hidden'
  );

}


function closeModal(){

  $('#modal').classList.add(
    'hidden'
  );

  $('#modal').innerHTML='';

}


window.closeModal=
  closeModal;


/* =========================================================
   REALTIME
========================================================= */

async function subscribe(){

  if(
    state.realtimeStarted
  ){

    console.log(
      'Messa Realtime: már elindult.'
    );

    return;
  }


  if(!state.user){

    console.error(
      'Messa Realtime: nincs bejelentkezett felhasználó.'
    );

    return;
  }


  state.realtimeStarted=true;


  const channel=
    db.channel(
      `messa-realtime-${state.user.id}`
    );


  /* =========================
     ÜZENETEK
  ========================= */

  channel.on(
    'postgres_changes',
    {
      event:'*',
      schema:'public',
      table:'messages',
      filter:
        `receiver_id=eq.${state.user.id}`
    },
    payload=>{

      console.log(
        'Messa Realtime - üzenet:',
        payload
      );


      if(
        state.view==='messages' &&
        state.chatUser
      ){

        renderMessages();

      }

    }
  );


  /* =========================
     SAJÁT ÜZENETEK VÁLTOZÁSA
  ========================= */

  channel.on(
    'postgres_changes',
    {
      event:'*',
      schema:'public',
      table:'messages',
      filter:
        `sender_id=eq.${state.user.id}`
    },
    payload=>{

      console.log(
        'Messa Realtime - saját üzenet:',
        payload
      );


      if(
        state.view==='messages' &&
        state.chatUser
      ){

        renderMessages();

      }

    }
  );


  /* =========================
     BEJEGYZÉSEK
  ========================= */

  channel.on(
    'postgres_changes',
    {
      event:'*',
      schema:'public',
      table:'posts'
    },
    payload=>{

      console.log(
        'Messa Realtime - bejegyzés:',
        payload
      );


      if(
        state.view==='home'
      ){

        renderHome();

      }

    }
  );


  /* =========================
     ÉRTESÍTÉSEK
  ========================= */

  channel.on(
    'postgres_changes',
    {
      event:'INSERT',
      schema:'public',
      table:'notifications',
      filter:
        `user_id=eq.${state.user.id}`
    },
    payload=>{

      console.log(
        'Messa Realtime - értesítés:',
        payload
      );


      toast(
        payload.new?.title ||
        '🔔 Új értesítés'
      );


      if(
        state.view==='notifications'
      ){

        renderNotifications();

      }

    }
  );


  /* =========================
     CSATLAKOZÁS
  ========================= */

  channel.subscribe(
    status=>{

      console.log(
        'Messa Realtime státusz:',
        status
      );


      if(status==='SUBSCRIBED'){

        state.subscriptions.push(
          channel
        );


        console.log(
          'Messa Realtime: sikeresen csatlakozva'
        );

      }


      if(
        status==='CHANNEL_ERROR' ||
        status==='TIMED_OUT' ||
        status==='CLOSED'
      ){

        console.error(
          'Messa Realtime hiba:',
          status
        );

      }

    }
  );

}


/* =========================================================
   BOOT
========================================================= */

async function boot(session){

  state.user=
    session.user;


  state.profileUserId=
    state.user.id;


  $('#authView')
    .classList
    .add('hidden');


  $('#appView')
    .classList
    .remove('hidden');


  try{

    await loadProfile();


    state.realtimeStarted=false;


    await subscribe();


    state.view='home';


    nav();


  }catch(e){

    console.error(e);

    toast(
      e.message
    );

  }

}


/* =========================================================
   AUTH SESSION
========================================================= */

(async()=>{

  const {
    data
  }=await db.auth.getSession();


  if(data.session){

    await boot(
      data.session
    );

  }


  db.auth.onAuthStateChange(
    async(
      event,
      session
    )=>{

      if(
        session &&
        !state.user
      ){

        await boot(
          session
        );

      }


      if(!session){

        state.user=null;

        state.profile=null;

        state.chatUser=null;

        state.profileUserId=null;

        state.realtimeStarted=false;


        state.subscriptions.forEach(
          s=>db.removeChannel(s)
        );


        state.subscriptions=[];


        $('#appView')
          .classList
          .add('hidden');


        $('#authView')
          .classList
          .remove('hidden');

      }

    }
  );

})();


/* =========================================================
   PWA
========================================================= */

if(
  'serviceWorker' in navigator
){

  window.addEventListener(
    'load',
    ()=>{

      navigator.serviceWorker
        .register('./sw.js')
        .catch(error=>{

          console.error(
            'Messa service worker registration failed:',
            error
          );

        });

    }
  );

}
```
