
 a = {}
 for(let key of Object.keys(chat.session.metadata.participants)){
	a[key] = [chat.session.settings.membersData[key], chat.session.metadata.participants[key].residence]
}

 a[chat.session.metadata.topicAuthority.pkfp] = ["Topic authority", chat.session.metadata.topicAuthority.residence]

 console.log(JSON.stringify(a))

