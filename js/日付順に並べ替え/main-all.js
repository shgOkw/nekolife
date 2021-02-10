/* jshint curly:true, debug:true */
/* globals $, firebase, moment */

// 現在ログインしているユーザID
let currentUID;

// Firebaseから取得したデータを一時保存しておくための変数
let dbdata = {};

//--------------------------------------------------------------------------------all用
// すべての投稿データを格納 (表示用)
let posts = [];
//--------------------------------------------------------------------------------

const formatDate = (date) => {
  const m = moment(date);
  return `${m.format('YYYY/MM/DD')}`;
};

/*------------------------------------------------------------------------
猫一覧
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

  $divTag.attr('id', `cat-id-${catId}`);

  const $deleteButton = $divTag.find('.cat__delete');
  $deleteButton.on('click', () => {
    console.log('削除ボタンが押されました');
    console.log(catId);
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

  dbdata = {};
  const usersRef = firebase.database().ref('users');

  usersRef.off('value');
  usersRef.on('value', (usersSnapshot) => {
    dbdata.users = usersSnapshot.val();

    if (dbdata.users === null || !dbdata.users[currentUID]) {
      const { currentUser } = firebase.auth();
      if (currentUser) {
        console.log('ユーザデータを作成します');
        firebase.database().ref(`users/${currentUID}`).set({
          nickname: currentUser.email,
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          updatedAt: firebase.database.ServerValue.TIMESTAMP,
        });

        return;
      }
    }

    Object.keys(dbdata.users).forEach((uid) => {
      updateNicknameDisplay(uid);
    });
  });

  const catRef = firebase.database().ref(`cats`);
  // .orderByChild('createdAt');

  catRef.off('child_added');
  catRef.off('child_removed');

  catRef.on('child_removed', (catSnapshot) => {
    const catId = catSnapshot.key;
    const $cat = $(`#cat-id-${catId}`);
    $cat.remove();
  });

  catRef.on('child_added', (catSnapshot) => {
    // const catId = catSnapshot.key;
    // const catData = catSnapshot.val();

    const catList = catSnapshot.val();

    $.each(catList, (catId, catData) => {
      addCat(catId, catData);
    });
  });

  //--------------------------------------------------------------------------------all用
  //※※※ 上のchild_addedは使わずに、on(''value)でやる？？
  catRef.on('value', (catSnapshot) => {
    const catsData = catSnapshot.val();

    //※※※ eachの重ね書き、もっとクールな書き方があるはず↓
    //※※※ 参考：https://hfuji.hatenablog.jp/entry/2019/04/30/223722
    $.each(catsData, (userId, catsList) => {
      $.each(catsList, (catId, catData) => {
        //※※※ Object.assignとは？？オブジェクトにデータを追加する的な？？
        let forPost = Object.assign({ id: catId }, catData);
        posts.push(forPost);
      });
    });

    console.log(posts);
    //※※※ 以下続き、完成させるには、影響範囲全体を書き換えないといけないかも？？
    //※※※ 一覧ページを独立させて試したほうがいいかも
    // createdAt で並び替え
    // $.each(posts... の中で addCat(catId, catData);
  });
  //--------------------------------------------------------------------------------
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
    $('footer').fadeIn(2000);
  }
};

/*------------------------------------------------------------------------
ログイン
------------------------------------------------------------------------*/
const resetLoginForm = () => {
  $('#login-form > .form-group').removeClass('has-error');
  $('#login__help').hide();
  $('#login__submit-button').prop('disabled', false).text('ログイン / 登録');
};

const onLogin = () => {
  console.log('ログイン完了');
  showView('main');
};

const onLogout = () => {
  firebase.database().ref('cats').off('value');
  dbdata = {};
  resetLoginForm();
  resetResetForm();
  resetCatView();
  resetSettingsModal();
  showView('login');
  viewReset();
  viewLoginFromReset();
  viewLoginFromConfirm();
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

/*------------------------------------------------------------------------
ログイン・ログアウト関連
------------------------------------------------------------------------*/
// ユーザ作成に失敗したことをユーザに通知する
const catchErrorOnCreateUser = (error) => {
  console.error('ユーザ作成に失敗:', error);
  if (error.code === 'auth/weak-password') {
    onWeakPassword();
  } else {
    onOtherLoginError(error);
  }
};

const catchErrorOnSignIn = (error) => {
  if (error.code === 'auth/wrong-password') {
    onWrongPassword();
  } else if (error.code === 'auth/too-many-requests') {
    onTooManyRequests();
  } else if (error.code === 'auth/invalid-email') {
    onInvalidEmail();
  } else {
    onOtherLoginError(error);
  }
};

// ログイン状態の変化を監視する
firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    currentUID = user.uid;
    onLogin();
  } else {
    currentUID = null;
    onLogout();
  }
});

$('#login-form').on('submit', (e) => {
  e.preventDefault();
  resetLoginForm();

  $('#login__submit-button').prop('disabled', true).text('送信中…');

  const email = $('#login-email').val();
  const password = $('#login-password').val();

  //ログインを試みて該当ユーザが存在しない場合は新規作成する
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
            console.log('ユーザを作成しました');
          })
          .catch(catchErrorOnCreateUser);
      } else {
        catchErrorOnSignIn(error);
      }
    });
});

// ログアウト
$('#logout-button').on('click', (e) => {
  e.preventDefault();

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
パスワードリセット
------------------------------------------------------------------------*/
const resetResetForm = () => {
  $('#resetting-form').val('');
  $('#resetting-form > .form-group').removeClass('has-error');
  $('#resetting__help').hide();
  $('#resetting__submit-button').prop('disabled', false).text('送信する');
};

const viewReset = () => {
  $('#login')
    .find('#to-reset-password')
    .on('click', () => {
      resetResetForm();
      $('#login-form').hide();
      $('#resetting').fadeIn(500);
    });
};
const viewLoginFromReset = () => {
  $('#resetting')
    .find('#back-login')
    .on('click', () => {
      resetResetForm();
      $('#resetting').hide();
      $('#login-form').fadeIn(500);
    });
};
const viewLoginFromConfirm = () => {
  $('#resetting-confirm')
    .find('#back-login')
    .on('click', () => {
      resetResetForm();
      $('#resetting-confirm').hide();
      $('#login-form').fadeIn(500);
    });
};

$('#resetting__submit-button').on('click', (e) => {
  e.preventDefault();
  resetResetForm();

  const getResetEmail = $('#resetting-email').val();
  console.log(getResetEmail);

  const auth = firebase.auth();
  const emailAddress = getResetEmail;

  auth
    .sendPasswordResetEmail(emailAddress)
    .then(function () {
      console.log(`メールを送信しました：${emailAddress}`);
      resetResetForm();
      $('#resetting').hide();
      $('#resetting-confirm').fadeIn(500);
    })
    .catch(function (error) {
      console.error(`送信失敗：${error}`);
    });
});

/*------------------------------------------------------------------------
投稿機能
------------------------------------------------------------------------*/
const resetAddCatModal = () => {
  $('#cat-form')[0].reset();
  $('#add-cat-image-label').text('');
  $('#submit_add_cat').prop('disabled', false).text('投稿する');
};

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

$('#cat-form').on('submit', (e) => {
  e.preventDefault();
  $('#submit_add_cat').prop('disabled', true).text('登録中…');

  const catName = $('#add-cat-name').val();
  const catGender = $('input:radio[name="cat-gender"]:checked').val();
  const $catImage = $('#add-cat-image');
  const { files } = $catImage[0];
  const articleTitle = $('#add-cat-article-title').val();
  const articleText = $('#add-cat-article-text').val();

  if (files.length === 0) {
    return;
  }

  const file = files[0]; // 画像ファイル
  const filename = file.name; // 画像ファイル名
  const catImageLocation = `cat-images/${currentUID}/${filename}`; // 画像ファイルのアップロード先

  firebase
    .storage()
    .ref(catImageLocation)
    .put(file) // アップロードを実行
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
      // モーダルを閉じて、初期状態に戻す
      $('#post-cat-modal').modal('hide');
      resetAddCatModal();
    })
    .catch((error) => {
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

// モーダル内の画像を表示
/*
（2021/01/23）
firebaseにリクエストを送らなくていいように書き換える！！
*/
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

/*------------------------------------------------------------------------
ニックネーム
------------------------------------------------------------------------*/
const resetSettingsModal = () => {
  $('#settings-form')[0].reset();
  $('#mypage-modal').modal('hide');
};

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
  if (!dbdata.users) {
    e.preventDefault();
  }

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
//hoverクラス付与
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
$('#to-top').on('click', (e) => {
  e.preventDefault();
  const contentsTop = $('#content').offset().top;
  $('html, body').animate({ scrollTop: contentsTop }, 500);
});
// ページの途中でリロードされた場合でも、ボタンが表示されるようにする
updateButton();
