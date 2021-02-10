/* jshint curly:true, debug:true */
/* globals $, firebase, moment */

// 現在ログインしているユーザID
let currentUID;

// Firebaseから取得したデータを一時保存しておくための変数
let dbdata = {};

const formatDate = (date) => {
  const m = moment(date);
  // return `${m.format('YYYY/MM/DD')}&nbsp;&nbsp;${m.format('HH:mm:ss')}`;
  return `${m.format('YYYY/MM/DD')}`;
};

/*------------------------------------------------------------------------
自分の猫一覧
------------------------------------------------------------------------*/
const downloadCatImage = (catImageLocation) =>
  firebase
    .storage()
    .ref(catImageLocation)
    .getDownloadURL()
    .then((url) => {
      return url;
    })
    .catch((error) => {
      console.error('写真のダウンロードに失敗:', error);
    });

const displayCatImage = ($divTag, url) => {
  $divTag.find('.cat-image').attr({
    src: url,
  });
};

//猫の削除
const deleteCat = (catId, catData) => {
  firebase.database().ref(`cats/${currentUID}/${catId}`).remove();
  firebase
    .storage()
    .ref()
    .child(`${catData.catImageLocation}`)
    .delete()
    .then(() => {
      console.log('ファイルを削除しました');
    })
    .catch((error) => {
      console.error('ファイルを削除できませんでした', error);
    });
};

//性別を表示
const getCatGender = ($divTag, catData) => {
  $divTag.find('.cat-name').addClass(catData.catGender);
  if (catData.catGender !== 'male') {
    $divTag.find('.cat-gender-icon').remove();
    $divTag
      .find('.cat-name')
      .append('<i class="cat-gender-icon fas fa-venus"></i>');
  }
};

const createCatDiv = (catId, catData) => {
  const $divTag = $('#cat-template > #cat-box').clone();

  getCatGender($divTag, catData);

  $divTag.find('.cat-name > span').text(catData.catName);
  $divTag.find('.article-date').html(formatDate(new Date(catData.createdAt)));
  $divTag.find('.article-title').text(catData.articleTitle);

  downloadCatImage(catData.catImageLocation).then((url) => {
    displayCatImage($divTag, url);
  });

  // id属性をセット
  $divTag.attr('id', `cat-id-${catId}`);

  const $deleteButton = $divTag.find('.cat__delete');
  $deleteButton.on('click', () => {
    console.log('削除ボタンが押されました');
    deleteCat(catId, catData);
  });

  return $divTag;
};

const resetCatView = () => {
  $('#view-cats > .inner').empty();
};

const addCat = (catId, catData) => {
  const $divTag = createCatDiv(catId, catData);
  $divTag.appendTo('#view-cats > .inner');
};

const loadCatView = () => {
  resetCatView();

  dbdata = {}; // キャッシュデータを空にする
  // ユーザ一覧を取得してさらに変更を監視
  const usersRef = firebase.database().ref('users');
  // 過去に登録したイベントハンドラを削除
  usersRef.off('value');

  // イベントハンドラを登録
  usersRef.on('value', (usersSnapshot) => {
    // usersに変更があるとこの中が実行される

    dbdata.users = usersSnapshot.val();

    // 自分のユーザデータが存在しない場合は作成
    if (dbdata.users === null || !dbdata.users[currentUID]) {
      const { currentUser } = firebase.auth();
      if (currentUser) {
        console.log('ユーザデータを作成します');
        firebase.database().ref(`users/${currentUID}`).set({
          nickname: currentUser.email,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          updatedAt: firebase.database.ServerValue.TIMESTAMP,
        });

        // このコールバック関数が再度呼ばれるのでこれ以上は処理しない
        return;
      }
    }

    Object.keys(dbdata.users).forEach((uid) => {
      updateNicknameDisplay(uid);
      // downloadProfileImage(uid);
    });
  });

  // 書籍データを取得
  const catRef = firebase
    .database()
    .ref(`cats`);

  // 過去に登録したイベントハンドラを削除
  catRef.off('child_added');
  catRef.off('child_removed');

  catRef.on('child_removed', (catSnapshot) => {
    const catId = catSnapshot.key;
    const $cat = $(`#cat-id-${catId}`);
    $cat.remove();
  });

  // books の child_addedイベントハンドラを登録
  // （データベースに書籍が追加保存されたときの処理）
  catRef.on('child_added', (catSnapshot) => {
    //const catId = catSnapshot.key;
    // const catUserId = catSnapshot.key;
    const catList = catSnapshot.val();
    
    console.log(catList);
    
    $.each(catList, (catId, catData) => {
      // 書籍一覧画面に書籍データを表示する
      addCat(catId, catData);
    });
    
  });
};

/*------------------------------------------------------------------------
すべての画面共通で使う関数
------------------------------------------------------------------------*/
// ビュー（画面）を変更する
const showView = (id) => {
  $('.view').hide();
  $(`#${id}`).fadeIn();

  if (id === 'main') {
    loadCatView();
  }
};

/*------------------------------------------------------------------------
ログイン
------------------------------------------------------------------------*/
// ログインフォームを初期状態に戻す
const resetLoginForm = () => {
  $('#login-form > .form-group').removeClass('has-error');
  $('#login__help').hide();
  $('#login__submit-button').prop('disabled', false).text('ログイン / 登録');
};

// ログインした直後に呼ばれる
const onLogin = () => {
  console.log('ログイン完了');

  // チャット画面を表示
  showView('main');
};

// ログアウトした直後に呼ばれる
const onLogout = () => {
  firebase.database().ref('cats').off('value');
  // firebase.database().ref('rooms').off('value');
  // currentRoomName = null;
  dbdata = {};
  resetLoginForm();
  resetCatView();
  resetSettingsModal();
  // location.reload();
  // resetFavoritesListModal(); // お気に入り一覧のモーダルを初期化
  showView('login');
};

// ユーザ作成のときパスワードが弱すぎる場合に呼ばれる
const onWeakPassword = () => {
  resetLoginForm();
  $('#login__password').addClass('has-error');
  $('#login__help').text('6文字以上のパスワードを入力してください').fadeIn();
};

// ログインのときパスワードが間違っている場合に呼ばれる
const onWrongPassword = () => {
  resetLoginForm();
  $('#login__password').addClass('has-error');
  $('#login__help').text('正しいパスワードを入力してください').fadeIn();
};

// ログインのとき試行回数が多すぎてブロックされている場合に呼ばれる
const onTooManyRequests = () => {
  resetLoginForm();
  $('#login__submit-button').prop('disabled', true);
  $('#login__help')
    .text('試行回数が多すぎます。後ほどお試しください。')
    .fadeIn();
};

// ログインのときメールアドレスの形式が正しくない場合に呼ばれる
const onInvalidEmail = () => {
  resetLoginForm();
  $('#login__email').addClass('has-error');
  $('#login__help').text('メールアドレスを正しく入力してください').fadeIn();
};

// その他のログインエラーの場合に呼ばれる
const onOtherLoginError = () => {
  resetLoginForm();
  $('#login__help').text('ログインに失敗しました').fadeIn();
};

/**
 * ---------------------------------------
 * 以下、コールバックやイベントハンドラの登録と、
 * ページ読み込みが完了したタイミングで行うDOM操作
 * ---------------------------------------
 */

/**
 * --------------------
 * ログイン・ログアウト関連
 * --------------------
 */
// ユーザ作成に失敗したことをユーザに通知する
const catchErrorOnCreateUser = (error) => {
  // 作成失敗
  console.error('ユーザ作成に失敗:', error);
  if (error.code === 'auth/weak-password') {
    onWeakPassword();
  } else {
    // その他のエラー
    onOtherLoginError(error);
  }
};

// ログインに失敗したことをユーザーに通知する
const catchErrorOnSignIn = (error) => {
  if (error.code === 'auth/wrong-password') {
    // パスワードの間違い
    onWrongPassword();
  } else if (error.code === 'auth/too-many-requests') {
    // 試行回数多すぎてブロック中
    onTooManyRequests();
  } else if (error.code === 'auth/invalid-email') {
    // メールアドレスの形式がおかしい
    onInvalidEmail();
  } else {
    // その他のエラー
    onOtherLoginError(error);
  }
};

// ログイン状態の変化を監視する
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    // ログイン済
    currentUID = user.uid;
    onLogin();
  } else {
    // 未ログイン
    currentUID = null;
    onLogout();
  }
});

// ログインフォームが送信されたらログインする
$('#login-form').on('submit', (e) => {
  e.preventDefault();

  // フォームを初期状態に戻す
  resetLoginForm();

  // ログインボタンを押せないようにする
  $('#login__submit-button').prop('disabled', true).text('送信中…');

  const email = $('#login-email').val();
  const password = $('#login-password').val();

  /**
   * ログインを試みて該当ユーザが存在しない場合は新規作成する
   * まずはログインを試みる
   */
  firebase
    .auth()
    .signInWithEmailAndPassword(email, password)
    .catch((error) => {
      console.log('ログイン失敗:', error);
      if (error.code === 'auth/user-not-found') {
        // 該当ユーザが存在しない場合は新規作成する
        firebase
          .auth()
          .createUserWithEmailAndPassword(email, password)
          .then(() => {
            // 作成成功
            console.log('ユーザを作成しました');
          })
          .catch(catchErrorOnCreateUser);
      } else {
        catchErrorOnSignIn(error);
      }
    });
});

// ログアウトがクリックされたらログアウトする
$('#logout-button').on('click', (e) => {
  e.preventDefault();

  // ハンバーガーメニューが開いている場合は閉じる
  $('#navbarSupportedContent').collapse('hide');

  firebase
    .auth()
    .signOut()
    .then(() => {
      // ログアウト成功
      window.location.hash = '';
    })
    .catch((error) => {
      console.error('ログアウトに失敗:', error);
    });
});

/*------------------------------------------------------------------------
投稿機能
------------------------------------------------------------------------*/
// 書籍の登録モーダルを初期状態に戻す
const resetAddCatModal = () => {
  $('#cat-form')[0].reset();
  $('#add-cat-image-label').text('');
  $('#submit_add_cat').prop('disabled', false).text('投稿する');
};

// 選択した表紙画像の、ファイル名を表示する
$('#add-cat-image').on('change', (e) => {
  const input = e.target;
  const $label = $('#add-cat-image-label');
  const file = input.files[0];

  if (file != null) {
    $label.text(file.name);
  } else {
    $label.text('ファイルを選択');
  }
});

// 書籍の登録処理

$('#cat-form').on('submit', (e) => {
  e.preventDefault();

  // 書籍の登録ボタンを押せないようにする
  $('#submit_add_cat').prop('disabled', true).text('登録中…');

  // 書籍タイトル
  const catName = $('#add-cat-name').val();
  const catGender = $('input:radio[name="cat-gender"]:checked').val();
  const $catImage = $('#add-cat-image');
  const { files } = $catImage[0];
  const articleTitle = $('#add-cat-article-title').val();
  const articleText = $('#add-cat-article-text').val();

  if (files.length === 0) {
    // ファイルが選択されていないなら何もしない
    return;
  }

  const file = files[0]; // 表紙画像ファイル
  const filename = file.name; // 画像ファイル名
  const catImageLocation = `cat-images/${currentUID}/${filename}`; // 画像ファイルのアップロード先

  // 書籍データを保存する
  firebase
    .storage()
    .ref(catImageLocation)
    .put(file) // Storageへファイルアップロードを実行
    .then(() => {
      // Storageへのアップロードに成功したら、Realtime Databaseに書籍データを保存する
      const catData = {
        catName,
        catGender,
        catImageLocation,
        uid: currentUID,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        articleTitle,
        articleText,
      };
      return firebase.database().ref(`cats/${currentUID}`).push(catData);
    })
    .then(() => {
      // 書籍一覧画面の書籍の登録モーダルを閉じて、初期状態に戻す
      $('#post-cat-modal').modal('hide');
      resetAddCatModal();
    })
    .catch((error) => {
      // 失敗したとき
      console.error('エラー', error);
      resetAddCatModal();
      $('#add-cat__help').text('保存できませんでした。').fadeIn();
    });
});

const resetModalCat = (textDiv, imageDiv) => {
  $('#article-modal').on('hidden.bs.modal', function () {
    textDiv.find('.cat-name > span').text('');
    textDiv.find('.title').text('');
    textDiv.find('.text').text('');
    textDiv.find('.date').html(formatDate(new Date('')));
    imageDiv.find('.cat-image').attr({
      src: '',
    });
    textDiv.find('.cat-name').removeClass('male');
    textDiv.find('.cat-name').removeClass('female');
    textDiv.find('.cat-gender-icon').remove();
    textDiv
      .find('.cat-name')
      .append('<i class="cat-gender-icon fas fa-mars"></i>');
  });
};

/////////////////////////////////////////////////////////////////////////////

//モーダル内の画像を表示
$(document).on('click', '.prof-image', (e) => {
  const imageDiv = $('#article-modal').find('.image-box');
  const textDiv = $('#article-modal').find('.text-box');

  const getParent = e.target.closest('.box');
  const getParentId = $(getParent).attr('id');
  const getCatId = getParentId.replace('cat-id-', '');

  const modalCatData = firebase
    .database()
    .ref(`cats/${currentUID}/${getCatId}`);

  modalCatData.on('value', (catSnapshot) => {
    const catData = catSnapshot.val();

    getCatGender(textDiv, catData);

    firebase
      .storage()
      .ref(catData.catImageLocation)
      .getDownloadURL()
      .then((url) => {
        // console.log('写真のダウンロード成功:', url);
        imageDiv.find('.cat-image').attr({
          src: url,
        });
      })
      .catch((error) => {
        console.error('写真のダウンロードに失敗:', error);
      });

    textDiv.find('.cat-name > span').text(catData.catName);
    textDiv.find('.title').text(catData.articleTitle);
    textDiv.find('.text').text(catData.articleText);
    textDiv.find('.date').html(formatDate(new Date(catData.createdAt)));
  });
  resetModalCat(textDiv, imageDiv);
});

/////////////////////////////////////////////////////////////////////////////

/*------------------------------------------------------------------------
マイページ ー ニックネーム
------------------------------------------------------------------------*/
// settingsModalを初期状態に戻す
const resetSettingsModal = () => {
  $('#settings-form')[0].reset();
  $('#mypage-modal').modal('hide');
};
// ニックネーム表示を更新する
const updateNicknameDisplay = (uid) => {
  const user = dbdata.users[uid];
  if (user) {
    $(`.nickname-${uid}`).text(user.nickname);
    if (uid === currentUID) {
      $('#menu-profile-name').text(user.nickname);
    }
  }
};

$('#mypage-modal').on('show.bs.modal', (e) => {
  // #settingsModalが表示される直前に実行する処理
  if (!dbdata.users) {
    e.preventDefault();
  }

  // ニックネームの欄に現在の値を入れる
  $('#settings-nickname').val(dbdata.users[currentUID].nickname);

  const user = dbdata.users[currentUID];

  $('#settings-nickname').on('change', (e) => {
    const newName = $(e.target).val();
    if (newName.length === 0) {
      // 入力されていない場合は何もしない
      return;
    }
    firebase.database().ref(`users/${currentUID}`).update({
      nickname: newName,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    });
  });
});

/*------------------------------------------------------------------------
その他
------------------------------------------------------------------------*/
//hoverしたらクラス付与
const onMouseenter = (e) => {
  $(e.currentTarget).addClass('on-mouse');
};
const onMouseleave = (e) => {
  $(e.currentTarget).removeClass('on-mouse');
};
$('.prof-image').on('mouseenter', onMouseenter).on('mouseleave', onMouseleave);

//トップへ戻る（anime.js利用）
// スクロールに応じてクラスを付与
const updateButton = () => {
  if ($(window).scrollTop() >= 300) {
    $('#to-top').addClass('fadein');
  } else {
    $('#to-top').removeClass('fadein');
  }
};
// スクロールされる度にupdateButtonを実行
$(window).on('scroll', updateButton);
// ボタンをクリックしたらページトップにスクロールする
$('#to-top').on('click', (e) => {
  // ボタンのhrefに遷移しない
  e.preventDefault();
  // 600ミリ秒かけてid="contents"までスクロールする
  const contentsTop = $('#content').offset().top;
  $('html, body').animate({ scrollTop: contentsTop }, 500);
});
// ページの途中でリロード（再読み込み）された場合でも、ボタンが表示されるようにする
updateButton();
