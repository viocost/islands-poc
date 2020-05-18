export function verifyPassword(password, confirm){
    if (!password || !password.trim() || !/^[a-zA-Z0-9!@#$%^&*]{9,}$/.test(password)){
        return "Password or passphrase must be at least 9 characters long and can contain only lowercase a-z, uppercase A-Z and symbols !@#$%^&*"
    }

    if(password !== confirm){
        return "Password and confirmation do not match."
    }

}
