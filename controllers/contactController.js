const validator = require("validator");
const nodemailer = require("nodemailer");
const { ObjectId } = require("mongodb");
const sanitizeHtml = require("sanitize-html");
const petsCollection = require("../db").db().collection("pets");
const contactsCollection = require("../db").db().collection("contacts");

const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {},
};
exports.submitContact = async function (req, res, next) {
  //me aseguro la respuesta venga en mayuxculas
  if (req.body.secret.toUpperCase() !== "PUPPY") {
    console.log("significa que es spam!");
    return res.json({ message: "sorry" });
  }
  //--guardar como strings
  if (typeof req.body.name !== "string") {
    req.body.name = "";
  }
  if (typeof req.body.email !== "string") {
    req.body.email = "";
  }
  if (typeof req.body.comment !== "string") {
    req.body.comment = "";
  }
  //uso validator
  if (!validator.isEmail(req.body.email)) {
    console.log("email no valido!");
    return res.json({ message: "sorry" });
  }
  if (!ObjectId.isValid(req.body.petId)) {
    //me aseguro id valido
    console.log("Invalid Id detected!");
    return res.json({ message: "sorry" });
  }
  // ychequeo si existe en mi base de datos
  // const doesPetExist = await petsCollection.findOne({
  //   _id: new ObjectId(req.body.petId),
  // }); //esto da warning deprecated
  // const doesPetExist = await petsCollection.findOne({
  //   _id: ObjectId.createFromHexString(req.body.petId),
  // });
  //video 84
  req.body.petId = ObjectId.createFromHexString(req.body.petId);
  //asi puede usarlo en doesPetExist y en ourObject !
  const doesPetExist = await petsCollection.findOne({
    _id: req.body.petId,
  });

  if (!doesPetExist) {
    console.log("This pet does not exist.");
    return res.json({ message: "sorry" });
  }
  //si existe lo sanitizamos antes de guardar en bd
  const ourObject = {
    petId: req.body.petId,
    name: sanitizeHtml(req.body.name, sanitizeOptions),
    email: sanitizeHtml(req.body.email, sanitizeOptions),
    comment: sanitizeHtml(req.body.comment, sanitizeOptions),
  };
  // console.log("desde contactController ", req.body);
  console.log("desde contactController ", ourObject);

  //---mailer
  var transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAPUSERNAME,
      pass: process.env.MAILTRAPPASSWORD,
    },
  });
  //ahora podemos usar
  // transport.sendMail({
  //   to: "maildecali@gmail.com",
  //   from: "calitaiji.com",
  //   subject: "Gracias por tu interes",
  //   html: "<h4>Gracias</h4>",
  // });

  try {
    const promise1 = transport.sendMail({
      to: ourObject.email,
      from: "calitaiji.com",
      subject: `Gracias por tu interes en ${doesPetExist.name} `,
      html: `<h4 style="color: red; font-size: 30px;">Gracias!</h4> 
      <p>We appreciate your interest in ${doesPetExist.name} and one of our staff members will reach out to you shortly. Bellow is a copy of the message you sent us for your personal record: </p>
      <p><em>${ourObject.comment}</em></p>
      `,
    });
    //---simula un segundo email para el administrador !
    const promise2 = transport.sendMail({
      to: "admin@petadoption.com",
      from: "info@petadoption.com",
      subject: `Someone is interested in ${doesPetExist.name} `,
      html: `<h4 style="color: red; font-size: 30px;">New message from Pets Adoption Center!</h4> 
      
      <p>Name: ${ourObject.name} </br>
      Pet interested in: ${doesPetExist.name} </br>
      Email: ${ourObject.email} </br>
      Message: <em>${ourObject.comment}</em>
      </p>
      <p>Thanks</p>
      `,
    });

    const promise3 = await contactsCollection.insertOne(ourObject);

    await Promise.all([promise1, promise2, promise3]);
  } catch (err) {
    next();
  }
  res.send("Thanks for sending data to us.");
};
//----view pet contacts
exports.viewPetContacts = async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    //si no es un id valido puede hacer crash la app por eso uso esto
    return res.redirect("/");
  }
  //igualo para usar dos veces abajo
  req.params.id = ObjectId.createFromHexString(req.params.id);

  const pet = await petsCollection.findOne({ _id: req.params.id });
  if (!pet) {
    console.log("Pet does not exist.");
    return res.redirect("/");
  }
  const contacts = await contactsCollection
    .find({
      petId: req.params.id,
    })
    .toArray();
  res.render("pet-contacts", { contacts, pet }); //lo creo en views folder
};
