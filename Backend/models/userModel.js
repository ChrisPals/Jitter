import mongoose from 'mongoose';

// build a scheme for usermodel
const userSchema = new mongoose.Schema({
    //mongoose check the validation when we create neew user 
    name: {type: String, require: true },
    // unique creates an index so when dont have duplicate email
    email:{type: String, required: true, unique: true},
    password:{type: String, required: true},
    //check for admin rights 
    isAdmin: { type: Boolean, default: false, required: true}
 } ,{
     // creates two fields for each record :'createdAt' and 'updatedAt'
        timestamps: true 
    
});

const User = mongoose.model("User", userSchema);
export default User; 