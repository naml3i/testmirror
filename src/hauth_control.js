function hauth_control(url) {
    // returning HTTP code with different extentions. Values here is fixed to see how unit testing works
    if (url === '/allow') {
      return 401;
    } else if (url === 'allow?foo=bar'){
        return 401
    } else if (url === '/skip'){
        return 200
    } else if (url === '/skip?foo=bar'){
        return 200
    } else if (url === '/skip/foo/bar'){
        return 200
    } else if (url === '/all_roles'){
        return 401
    } else if (url === '/only_role1'){
        return 200
    } else {
        return 401
    } 
  }
  
//   export default hauth_control;

module.exports = hauth_control;