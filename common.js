exports.callRevs = function(revs){
	let _revs = []
	for (var i = revs.length-1; i >=0; i--) {
		let rev = revs[i]
		_revs.push(rev())
	}
	return ()=>exports.callRevs(_revs)
}

exports.emptyRev = function(){
	return ()=>exports.emptyRev()
}
