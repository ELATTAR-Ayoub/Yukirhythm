import type { NextApiRequest, NextApiResponse } from "next";

import nodemailer from "nodemailer";

// Interfaces
import { Offer } from "@/constants/interfaces";

// export async function sendEmail(to: string, subject: string, offer: Offer) {
//     const transporter = nodemailer.createTransport({
//         host: 'smtp.gmail.com',
//         port: 465,
//         secure: true,
//         auth: {
//             user: process.env.NEXT_PUBLIC_GMAILEMAIL,
//             pass: process.env.NEXT_PUBLIC_GMAILPASSWORD,
//         },
//     });

//     console.log('offer', offer);
//     console.log('to', to);
//     console.log('subject', subject);

//     const currentDate = new Date().toLocaleDateString('en-US', {
//         weekday: 'long',
//         year: 'numeric',
//         month: 'short',
//         day: 'numeric'
//       });

//     try {
//         const info = await transporter.sendMail({
//             from: process.env.NEXT_PUBLIC_GMAILEMAIL,
//             to,
//             subject,
//             html: `
//             <h1>New offer</h1>
//             <br/>
//             <h2><strong>The Info:</strong></h2>
//             <p><strong>First name:</strong><br> ${offer.firstName}</p>
//             <p><strong>Last name:</strong><br> ${offer.lastName}</p>
//             <p><strong>Email:</strong><br> ${offer.email}</p>
//             <p><strong>Phone:</strong><br> ${offer.phone}</p>

//             <h2><strong>The Reasons:</strong></h2>
//             <ul>
//                 ${offer.reasons.map((reason) =>
//                     `<li>${reason}</li> <br/>`
//                 )}
//             </ul>

//             <h2><strong>The Additional information:</strong></h2>
//             <br>
//                 <p>${offer.additionalInfo}</p>
//             <br>

//             <h2><strong>The Date:</strong></h2>
//             <br>
//                 <p>${currentDate}</p>
//             <br>
//             `
//             ,
//         });

//         console.log('Message sent: %s', info.messageId);
//         return { success: true };
//     } catch (error:any) {
//         console.error(error);
//         return { success: false, message: error.message };
//     }
// }

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    const data = req.body;
    // await sendEmail(data.to, data.subject, data.offerData);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("error,", error);
    return res.status(400).json({ message: error.message });
  }
};

export default handler;
