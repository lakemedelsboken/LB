

// Checks that login is OK
function checkLogin() {

	var MatchHyphen = /\d{6}-\d{4}/ ;
	var MatchNoHyphen = /\d{10}/ ;


	if(login.username.value == '') {
		alert("Du måste fylla i både personnummer och lösenord.") ;
		login.username.focus() ;
		return false ;
	}


	if(login.username.value.length < 10 || login.username.value.length > 11 ) {
		alert("Personnumret är inte giltigt.") ;
		login.username.focus() ;
		return false ;
	}

	if(login.username.value.length == 10) {
		if((MatchNoHyphen.test(login.username.value)) != 1) {
			alert("Personnumret är inte giltigt.") ;
			login.username.focus() ;
			return false ;
		}
	}
	
	if(login.username.value.length == 11) {
		if((MatchHyphen.test(login.username.value)) != 1) {
			alert("Personnumret är inte giltigt.") ;
			login.username.focus() ;
			return false ;
		}
	}

	if(login.pwd.value == '') {
		alert("Du måste fylla i både personnummer och lösenord.") ;
		login.pwd.focus() ;
		return false ;
	}
	
	if(login.pwd.value.length != 8) {
		alert("Lösenordet  är inte giltigt.") ;
		login.pwd.focus() ;
		return false ;
	}

	//login.pwd.value = '' ;
	return true;
}

function DisplayHelpWindow() {
	newWindow = open("loginhelp.htm", "displayHelpWindow", "width=312,height=232,directories=no,location=no,menubar=no,resizable=yes,status=no,titlebar=no");
	
}